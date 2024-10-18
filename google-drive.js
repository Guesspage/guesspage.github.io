// Google Drive API configuration
const CLIENT_ID = '448369537106-vep7t49jrduqkps8qbinjndc1lqhoa0j.apps.googleusercontent.com';
const API_KEY = 'AIzaSyB-050uA1nT5qf3OGXjqN9nhNJ7bzSDKiA'; // ggignore
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const GUESSBOOK_FOLDER_NAME = 'Guessbook Files';

let tokenClient;
let accessToken = null;
let currentFileId = null;

async function initializeGoogleDrive() {
    console.log("Initializing Google Drive integration");
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (tokenResponse) => {
            console.log("Token received:", tokenResponse);
            accessToken = tokenResponse.access_token;
            saveTokenToLocalStorage(accessToken);
            await updateSigninStatus(true);
        },
    });

    await new Promise((resolve) => gapi.load('client', resolve));
    await initializeGapiClient();

    const savedToken = loadTokenFromLocalStorage();
    if (savedToken) {
        accessToken = savedToken;
        await updateSigninStatus(true);
        console.log("Restored session from saved token");
    } else {
        await updateSigninStatus(false);
    }

    // Check for file ID in URL and load if present
    const urlParams = new URLSearchParams(window.location.search);
    const fileId = urlParams.get('fileId');
    if (fileId) {
        await loadFileFromId(fileId);
    }
}

async function updateSigninStatus(isSignedIn) {
    console.log("Updating signin status:", isSignedIn);
    const authStatus = document.getElementById('auth-status');
    const saveBtn = document.getElementById('save-btn');
    const signinBtn = document.getElementById('signin-btn');

    if (isSignedIn && accessToken) {
        const isValid = await validateToken(accessToken);
        if (isValid) {
            console.log("User is signed in with a valid token");
            authStatus.textContent = 'Signed in';
            saveBtn.disabled = false;
            signinBtn.textContent = 'Sign Out';
        } else {
            console.log("Token is invalid, signing out");
            accessToken = null;
            clearTokenFromLocalStorage();
            await updateSigninStatus(false);
            return;
        }
    } else {
        console.log("User is signed out");
        authStatus.textContent = 'Signed out';
        saveBtn.disabled = true;
        signinBtn.textContent = 'Sign In';
        accessToken = null;
    }
}

async function validateToken(token) {
    try {
        const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
        const result = await response.json();

        if (result.error) {
            console.log("Token is invalid:", result.error);
            return false;
        }

        console.log("Token is valid");
        return true;
    } catch (error) {
        console.error("Error validating token:", error);
        return false;
    }
}

function saveTokenToLocalStorage(token) {
    localStorage.setItem('guessbook_access_token', token);
    localStorage.setItem('guessbook_token_timestamp', Date.now().toString());
}

function loadTokenFromLocalStorage() {
    const token = localStorage.getItem('guessbook_access_token');
    const timestamp = localStorage.getItem('guessbook_token_timestamp');

    if (token && timestamp) {
        // Check if the token is less than 1 hour old
        if (Date.now() - parseInt(timestamp) < 3600000) {
            return token;
        }
    }
    return null;
}

function clearTokenFromLocalStorage() {
    localStorage.removeItem('guessbook_access_token');
    localStorage.removeItem('guessbook_token_timestamp');
}


async function saveFile(content) {
    if (!accessToken) {
        showNotification('Please sign in to save', 'error');
        return;
    }

    try {
        const folderId = await getGuessbookFolder();

        const metadata = {
            name: 'Guessbook Document',
            mimeType: 'application/json',
            parents: currentFileId ? [] : [folderId]
        };

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
        form.append('file', new Blob([content], {type: 'application/json'}));

        const response = await fetch(
            currentFileId
                ? `https://www.googleapis.com/upload/drive/v3/files/${currentFileId}?uploadType=multipart`
                : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
                method: currentFileId ? 'PATCH' : 'POST',
                headers: new Headers({'Authorization': 'Bearer ' + accessToken}),
                body: form,
            }
        );

        const result = await response.json();

        if (response.ok) {
            currentFileId = result.id;
            updateUrlWithFileId(currentFileId);
            await makeFilePublic(currentFileId);
            showNotification('File saved successfully');
            return currentFileId;
        } else {
            throw new Error(result.error.message);
        }
    } catch (error) {
        showNotification('Error saving file: ' + error.message, 'error');
    }
}

async function makeFilePublic(fileId) {
    try {
        await gapi.client.drive.permissions.create({
            fileId: fileId,
            resource: {
                role: 'reader',
                type: 'anyone'
            }
        });
        console.log('File made public');
    } catch (error) {
        console.error('Error making file public:', error);
    }
}

async function loadFileFromId(fileId) {
    try {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            {
                headers: new Headers({'Authorization': 'Bearer ' + accessToken}),
            }
        );

        if (response.ok) {
            const content = await response.text();
            document.getElementById('raw-input').value = content;
            currentFileId = fileId;
            showNotification('File loaded successfully');
            updateView(); // Assuming this function exists to update the view
        } else {
            const error = await response.json();
            throw new Error(error.error.message);
        }
    } catch (error) {
        showNotification('Error loading file: ' + error.message, 'error');
    }
}

function updateUrlWithFileId(fileId) {
    const url = new URL(window.location);
    url.searchParams.set('fileId', fileId);
    window.history.pushState({}, '', url);
}

async function getGuessbookFolder() {
    try {
        // Check if the folder already exists
        let response = await gapi.client.drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and name='${GUESSBOOK_FOLDER_NAME}' and trashed=false`,
            fields: 'files(id, name)'
        });

        let folder = response.result.files[0];

        if (folder) {
            console.log('Guessbook folder found:', folder.id);
            return folder.id;
        } else {
            // Create the folder if it doesn't exist
            let folderMetadata = {
                'name': GUESSBOOK_FOLDER_NAME,
                'mimeType': 'application/vnd.google-apps.folder'
            };
            let folderResponse = await gapi.client.drive.files.create({
                resource: folderMetadata,
                fields: 'id'
            });
            console.log('Guessbook folder created:', folderResponse.result.id);
            return folderResponse.result.id;
        }
    } catch (error) {
        console.error('Error getting or creating Guessbook folder:', error);
        throw error;
    }
}

async function handleAuthClick() {
    console.log("Auth button clicked, current accessToken:", accessToken);
    if (accessToken === null) {
        console.log("Requesting access token");
        tokenClient.requestAccessToken();
    } else {
        console.log("Revoking access token");
        await new Promise((resolve) => {
            google.accounts.oauth2.revoke(accessToken, async () => {
                console.log("Token revoked");
                accessToken = null;
                clearTokenFromLocalStorage();
                await updateSigninStatus(false);
                resolve();
            });
        });
    }
}

document.getElementById('signin-btn').addEventListener('click', handleAuthClick);
document.getElementById('save-btn').addEventListener('click', () => {
    const content = document.getElementById('raw-input').value;
    saveFile(content);
});

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.backgroundColor = type === 'success' ? '#4CAF50' : '#f44336';
    notification.style.display = 'block';
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}

// Initialize Google Drive integration when the page loads
window.onload = initializeGoogleDrive;
