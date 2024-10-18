// Google Drive API configuration
const CLIENT_ID = '448369537106-vep7t49jrduqkps8qbinjndc1lqhoa0j.apps.googleusercontent.com';
const API_KEY = 'AIzaSyB-050uA1nT5qf3OGXjqN9nhNJ7bzSDKiA'; // ggignore
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const GUESSBOOK_FOLDER_NAME = 'Guessbook Files';

let tokenClient;
let accessToken = null;

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
}

async function initializeGapiClient() {
    console.log("Initializing GAPI client");
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: DISCOVERY_DOCS,
        });
        gapi.auth.setToken({ access_token: accessToken });
        console.log("GAPI client initialized successfully");
    } catch (error) {
        console.error("Error initializing GAPI client:", error);
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
            gapi.auth.setToken({ access_token: accessToken });
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
        return null;
    }

    try {
        const folderId = await getGuessbookFolder();

        if (!folderId) {
            throw new Error('Unable to access Guessbook folder');
        }

        const metadata = {
            name: 'Guessbook Document',
            mimeType: 'application/json',
            parents: [folderId]
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
            await makeFilePublic(result.id);
            showNotification('File saved and made public successfully');
            return result.id;
        } else {
            throw new Error(result.error.message);
        }
    } catch (error) {
        showNotification('Error saving file: ' + error.message, 'error');
        return null;
    }
}

async function makeFilePublic(fileId) {
    if (!accessToken) {
        throw new Error('Not authenticated');
    }

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
        throw error;
    }
}

async function loadFileFromId(fileId) {
    try {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            {
                method: 'GET'
            }
        );

        if (response.ok) {
            const content = await response.text();
            showNotification('File loaded successfully');
            return content;
        } else {
            const error = await response.json();
            throw new Error(error.error.message);
        }
    } catch (error) {
        showNotification('Error loading file: ' + error.message, 'error');
        throw error;
    }
}

function updateUrlWithFileId(fileId) {
    const url = new URL(window.location);
    url.searchParams.set('fileId', fileId);
    window.history.pushState({}, '', url);
}

async function getGuessbookFolder() {
    if (!accessToken) {
        throw new Error('Not authenticated');
    }

    try {
        // First, try to find an existing folder
        let response = await gapi.client.drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and name='${GUESSBOOK_FOLDER_NAME}' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        let folder = response.result.files[0];

        if (folder) {
            console.log('Found existing Guessbook folder:', folder.id);
            return folder.id;
        }

        // If no folder found, create a new one
        let folderMetadata = {
            'name': GUESSBOOK_FOLDER_NAME,
            'mimeType': 'application/vnd.google-apps.folder'
        };
        let folderResponse = await gapi.client.drive.files.create({
            resource: folderMetadata,
            fields: 'id'
        });
        console.log('Created new Guessbook folder:', folderResponse.result.id);
        return folderResponse.result.id;
    } catch (error) {
        console.error('Error getting or creating Guessbook folder:', error);
        throw new Error('Unable to access or create Guessbook folder');
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

async function handleSave() {
    const content = rawInput.value;
    saveToLocalStorage();

    try {
        const fileId = await saveFile(content);
        if (fileId) {
            currentFileId = fileId;
            showNotification('File saved successfully to Google Drive');
        } else {
            throw new Error('Failed to save file to Google Drive');
        }
    } catch (error) {
        console.error('Error saving to Google Drive:', error);
        showNotification('Error saving to Google Drive. Changes saved locally.', 'error');
    }
}

document.getElementById('signin-btn').addEventListener('click', handleAuthClick);
document.getElementById('save-btn').addEventListener('click', handleSave);

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.style.backgroundColor = type === 'success' ? '#4CAF50' : '#f44336';
    notification.style.display = 'block';
    setTimeout(() => {
        notification.style.display = 'none';
    }, 3000);
}
