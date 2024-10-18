// Google Drive API configuration
const CLIENT_ID = '448369537106-vep7t49jrduqkps8qbinjndc1lqhoa0j.apps.googleusercontent.com';
const API_KEY = 'AIzaSyB-050uA1nT5qf3OGXjqN9nhNJ7bzSDKiA'; // ggignore
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient;
let accessToken = null;

function initializeGoogleDrive() {
    console.log("Initializing Google Drive integration");
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
            console.log("Token received:", tokenResponse);
            accessToken = tokenResponse.access_token;
            updateSigninStatus(true);
        },
    });

    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    console.log("Initializing GAPI client");
    try {
        await gapi.client.init({
            apiKey: API_KEY,
            discoveryDocs: DISCOVERY_DOCS,
        });
        console.log("GAPI client initialized successfully");
    } catch (error) {
        console.error("Error initializing GAPI client:", error);
    }
}

function updateSigninStatus(isSignedIn) {
    console.log("Updating signin status:", isSignedIn);
    const authStatus = document.getElementById('auth-status');
    const saveBtn = document.getElementById('save-btn');
    const loadBtn = document.getElementById('load-btn');

    if (isSignedIn) {
        console.log("User is signed in");
        authStatus.textContent = 'Signed in';
        saveBtn.disabled = false;
        loadBtn.disabled = false;
    } else {
        console.log("User is signed out");
        authStatus.textContent = 'Signed out';
        saveBtn.disabled = true;
        loadBtn.disabled = true;
    }
}

function handleAuthClick() {
    if (accessToken === null) {
        tokenClient.requestAccessToken();
    } else {
        accessToken = null;
        updateSigninStatus(false);
    }
}

async function saveFile(content, fileId = null) {
    if (!accessToken) {
        showNotification('Please sign in to save', 'error');
        return;
    }

    const metadata = {
        name: 'Guessbook Document',
        mimeType: 'application/json',
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], {type: 'application/json'}));
    form.append('file', new Blob([content], {type: 'application/json'}));

    try {
        const response = await fetch(
            fileId
                ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
                : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
                method: fileId ? 'PATCH' : 'POST',
                headers: new Headers({'Authorization': 'Bearer ' + accessToken}),
                body: form,
            }
        );

        const result = await response.json();

        if (response.ok) {
            showNotification('File saved successfully');
            return result.id;
        } else {
            throw new Error(result.error.message);
        }
    } catch (error) {
        showNotification('Error saving file: ' + error.message, 'error');
    }
}

async function loadFile(fileId) {
    if (!accessToken) {
        showNotification('Please sign in to load', 'error');
        return;
    }

    try {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
            {
                headers: new Headers({'Authorization': 'Bearer ' + accessToken}),
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
    }
}

async function listFiles() {
    if (!accessToken) {
        showNotification('Please sign in to list files', 'error');
        return;
    }

    try {
        const response = await gapi.client.drive.files.list({
            q: "mimeType='application/json' and name contains 'Guessbook Document'",
            fields: 'files(id, name, modifiedTime)',
            orderBy: 'modifiedTime desc'
        });

        return response.result.files;
    } catch (error) {
        showNotification('Error listing files: ' + error.message, 'error');
    }
}

function showFileBrowser() {
    const fileBrowser = document.getElementById('file-browser');
    const fileList = document.getElementById('file-list');
    const fileSearch = document.getElementById('file-search');

    fileBrowser.style.display = 'block';
    fileList.innerHTML = 'Loading...';

    listFiles().then(files => {
        fileList.innerHTML = '';
        files.forEach(file => {
            const li = document.createElement('li');
            li.textContent = `${file.name} (Last modified: ${new Date(file.modifiedTime).toLocaleString()})`;
            li.onclick = () => loadFile(file.id).then(content => {
                if (content) {
                    document.getElementById('raw-input').value = content;
                    fileBrowser.style.display = 'none';
                    updateView();
                }
            });
            fileList.appendChild(li);
        });
    });

    fileSearch.oninput = () => {
        const searchTerm = fileSearch.value.toLowerCase();
        Array.from(fileList.children).forEach(li => {
            li.style.display = li.textContent.toLowerCase().includes(searchTerm) ? '' : 'none';
        });
    };
}

document.getElementById('close-file-browser').onclick = () => {
    document.getElementById('file-browser').style.display = 'none';
};

function handleAuthClick() {
    console.log("Auth button clicked, current accessToken:", accessToken);
    if (accessToken === null) {
        console.log("Requesting access token");
        tokenClient.requestAccessToken();
    } else {
        console.log("Revoking access token");
        google.accounts.oauth2.revoke(accessToken, () => {
            console.log("Token revoked");
            accessToken = null;
            updateSigninStatus(false);
        });
    }
}

document.getElementById('signin-btn').addEventListener('click', handleAuthClick);

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
