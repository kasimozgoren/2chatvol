// --- FIREBASE BAĞLANTISI VE KURULUMU ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, query, orderBy, updateDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBRT6OUMjOClZ1mT3G1fOe5C9jy0uj-XBw",
    authDomain: "sohbet0707.firebaseapp.com",
    projectId: "sohbet0707",
    storageBucket: "sohbet0707.firebasestorage.app",
    messagingSenderId: "478352321618",
    appId: "1:478352321618:web:d57ec80cb4d3115f90838b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- STATE YÖNETİMİ ---
let messages = []; 
let currentUser = '';
let unsubscribeMessages = null;

const passwordScreen = document.getElementById('password-screen');
const passwordInput = document.getElementById('password-input');
const passwordBtn = document.getElementById('password-btn');

const loginScreen = document.getElementById('login-screen');
const chatScreen = document.getElementById('chat-screen');
const chatTitle = document.getElementById('chat-title');
const chatBox = document.getElementById('chat-box');

// ŞİFRE KONTROLÜ
passwordBtn.addEventListener('click', () => {
    if(passwordInput.value === 'essek') {
        passwordScreen.classList.remove('active');
        setTimeout(() => {
            passwordScreen.style.display = 'none';
            loginScreen.style.display = 'flex';
            setTimeout(() => loginScreen.classList.add('active'), 50);
        }, 350);
    } else {
        alert('Hatalı şifre!');
        passwordInput.value = '';
    }
});
passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') passwordBtn.click(); });


function updateBadges() {
    let merveUnread = messages.filter(m => m.sender === 'kasim' && !m.isRead).length;
    let kasimUnread = messages.filter(m => m.sender === 'merve' && !m.isRead).length;

    const badgeMerve = document.getElementById('badge-merve');
    const badgeKasim = document.getElementById('badge-kasim');

    if(merveUnread > 0) { badgeMerve.innerText = merveUnread; badgeMerve.classList.remove('hidden'); } else { badgeMerve.classList.add('hidden'); }
    if(kasimUnread > 0) { badgeKasim.innerText = kasimUnread; badgeKasim.classList.remove('hidden'); } else { badgeKasim.classList.add('hidden'); }
}

function selectUser(user) {
    currentUser = user;
    document.body.className = '';
    document.body.classList.add(`theme-${user}`);
    chatTitle.innerText = user === 'merve' ? 'Merve (Sen)' : 'Kasım (Sen)';
    
    messages.forEach(async (m) => { 
        if (m.sender !== currentUser && !m.isRead) {
            const msgRef = doc(db, "messages", m.id);
            await updateDoc(msgRef, { isRead: true });
        } 
    });

    listenToMessages();
    
    loginScreen.classList.remove('active');
    setTimeout(() => {
        loginScreen.style.display = 'none';
        chatScreen.style.display = 'flex';
        setTimeout(() => chatScreen.classList.add('active'), 50);
        chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' });
    }, 350);
}

function logout() {
    closeAudioPreview();
    if(unsubscribeMessages) unsubscribeMessages();

    chatScreen.classList.remove('active');
    setTimeout(() => {
        chatScreen.style.display = 'none';
        loginScreen.style.display = 'flex';
        setTimeout(() => loginScreen.classList.add('active'), 50);
    }, 350);
}

window.selectUser = selectUser;
window.logout = logout;

// --- FİREBASE VERİTABANI İŞLEMLERİ ---
function listenToMessages() {
    const q = query(collection(db, "messages"), orderBy("createdAt", "asc"));
    
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        messages = [];
        snapshot.forEach((docSnap) => {
            let data = docSnap.data();
            data.id = docSnap.id;
            messages.push(data);
            
            if (data.sender !== currentUser && !data.isRead && chatScreen.classList.contains('active')) {
                updateDoc(docSnap.ref, { isRead: true });
            }
        });
        updateBadges();
        renderMessages();
    });
}

async function saveAndSendMessage(content, type = 'text') {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    await addDoc(collection(db, "messages"), {
        sender: currentUser,
        type: type,
        content: content,
        timestamp: timeString,
        createdAt: Date.now(),
        isRead: false 
    });
}

// MESAJ SİLME FONKSİYONU
window.deleteMessage = async function(id) {
    if(confirm("Bu mesajı silmek istediğine emin misin?")) {
        try {
            await deleteDoc(doc(db, "messages", id));
        } catch (error) {
            console.error("Silme hatası:", error);
        }
    }
}

// --- MESAJLARI ÇİZME ---
function renderMessages() {
    chatBox.innerHTML = ''; 
    
    messages.forEach(msg => {
        const isMine = msg.sender === currentUser;
        const msgDiv = document.createElement('div');
        msgDiv.className = `message ${isMine ? 'sent' : 'received'}`;
        
        let contentHTML = '';
        if (msg.type === 'audio') {
            contentHTML = `
                <div class="msg-audio-player">
                    <button class="msg-play-btn" id="playBtn-${msg.id}" onclick="toggleMsgAudio('${msg.id}')">▶️</button>
                    <div class="msg-audio-timeline">
                        <input type="range" class="msg-seek-bar" id="seekBar-${msg.id}" value="0" step="0.1" oninput="seekMsgAudio('${msg.id}')">
                        <div class="msg-audio-time" id="time-${msg.id}">00:00</div>
                    </div>
                    <button class="msg-speed-btn" id="speedBtn-${msg.id}" onclick="toggleSpeed('${msg.id}')">1x</button>
                    <audio id="audio-${msg.id}" src="${msg.content}" 
                           onloadedmetadata="initMsgAudio('${msg.id}')" 
                           ontimeupdate="updateMsgAudio('${msg.id}')" 
                           onended="endMsgAudio('${msg.id}')"></audio>
                </div>
            `;
        } else {
            contentHTML = `<div class="text-content">${msg.content}</div>`;
        }

        // Kırmızı buton olarak eklendi
        let deleteBtnHTML = isMine ? `<button class="delete-btn" onclick="deleteMessage('${msg.id}')">Sil 🗑️</button>` : '';
        let ticksHTML = isMine ? (msg.isRead ? '<span class="tick read">✓✓</span>' : '<span class="tick">✓</span>') : '';

        msgDiv.innerHTML = `
            ${contentHTML}
            <div class="message-meta">
                ${deleteBtnHTML}
                <span>${msg.timestamp}</span>
                ${ticksHTML}
            </div>
        `;
        chatBox.appendChild(msgDiv);
    });

    chatBox.scrollTo({ top: chatBox.scrollHeight, behavior: 'smooth' }); 
}

const messageInput = document.getElementById('message-input');
const sendTextBtn = document.getElementById('send-text-btn');

sendTextBtn.addEventListener('click', () => {
    const text = messageInput.value.trim();
    if (text) { saveAndSendMessage(text, 'text'); messageInput.value = ''; }
});
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendTextBtn.click(); });

// --- SES KONTROLLERİ ---
let currentlyPlayingAudio = null;
let currentlyPlayingBtn = null;

window.initMsgAudio = function(id) {
    const audio = document.getElementById(`audio-${id}`);
    const timeDisplay = document.getElementById(`time-${id}`);
    const seekBar = document.getElementById(`seekBar-${id}`);
    if(audio.duration !== Infinity && !isNaN(audio.duration)) {
        seekBar.max = audio.duration;
        timeDisplay.innerText = formatTime(audio.duration);
    }
}

window.toggleMsgAudio = function(id) {
    const audio = document.getElementById(`audio-${id}`);
    const playBtn = document.getElementById(`playBtn-${id}`);

    if (currentlyPlayingAudio && currentlyPlayingAudio !== audio) {
        currentlyPlayingAudio.pause();
        if(currentlyPlayingBtn) currentlyPlayingBtn.innerText = '▶️';
    }

    if (audio.paused) {
        audio.play();
        playBtn.innerText = '⏸️';
        currentlyPlayingAudio = audio;
        currentlyPlayingBtn = playBtn;
    } else {
        audio.pause();
        playBtn.innerText = '▶️';
        currentlyPlayingAudio = null;
        currentlyPlayingBtn = null;
    }
}

window.updateMsgAudio = function(id) {
    const audio = document.getElementById(`audio-${id}`);
    const seekBar = document.getElementById(`seekBar-${id}`);
    const timeDisplay = document.getElementById(`time-${id}`);
    
    seekBar.value = audio.currentTime;
    timeDisplay.innerText = formatTime(audio.currentTime);
}

window.seekMsgAudio = function(id) {
    const audio = document.getElementById(`audio-${id}`);
    const seekBar = document.getElementById(`seekBar-${id}`);
    audio.currentTime = seekBar.value;
}

window.endMsgAudio = function(id) {
    const playBtn = document.getElementById(`playBtn-${id}`);
    const audio = document.getElementById(`audio-${id}`);
    playBtn.innerText = '▶️';
    audio.currentTime = 0;
    document.getElementById(`seekBar-${id}`).value = 0;
    currentlyPlayingAudio = null;
    currentlyPlayingBtn = null;
}

window.toggleSpeed = function(id) {
    const audio = document.getElementById(`audio-${id}`);
    const speedBtn = document.getElementById(`speedBtn-${id}`);
    if (audio.playbackRate === 1) { audio.playbackRate = 1.5; speedBtn.innerText = '1.5x'; speedBtn.style.color = '#facc15'; } 
    else if (audio.playbackRate === 1.5) { audio.playbackRate = 2; speedBtn.innerText = '2x'; speedBtn.style.color = '#ef4444'; } 
    else { audio.playbackRate = 1; speedBtn.innerText = '1x'; speedBtn.style.color = 'white'; }
}

// --- SES KAYIT ---
let mediaRecorder;
let audioChunks = [];
let audioBlobUrl = null;
let recordingInterval;
let recordingSeconds = 0;

const recordBtn = document.getElementById('record-btn');
const stopRecordBtn = document.getElementById('stop-record-btn');
const audioPreviewContainer = document.getElementById('audio-preview-container');
const recordingAnimation = document.getElementById('recording-animation');
const recordingTimeDisplay = document.getElementById('recording-time');

recordBtn.addEventListener('click', async () => {
    try {
        const constraints = { audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true } };
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = event => { audioChunks.push(event.data); };
        mediaRecorder.onstop = () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            audioBlobUrl = URL.createObjectURL(audioBlob);
            prepareCustomPlayer(audioBlobUrl);
            audioPreviewContainer.classList.remove('hidden');
        };

        mediaRecorder.start();
        recordBtn.classList.add('hidden');
        messageInput.classList.add('hidden');
        sendTextBtn.classList.add('hidden');
        stopRecordBtn.classList.remove('hidden');
        recordingAnimation.classList.remove('hidden');

        recordingSeconds = 0;
        recordingTimeDisplay.innerText = "00:00";
        recordingInterval = setInterval(() => {
            recordingSeconds++;
            recordingTimeDisplay.innerText = formatTime(recordingSeconds);
        }, 1000);
    } catch (err) { alert("Mikrofona erişilemedi. İzinleri kontrol edin."); }
});

stopRecordBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
        clearInterval(recordingInterval);
        recordingAnimation.classList.add('hidden');
        stopRecordBtn.classList.add('hidden');
        recordBtn.classList.remove('hidden');
        messageInput.classList.remove('hidden');
        sendTextBtn.classList.remove('hidden');
    }
});

// --- SES ÖNİZLEME OYNATICI ---
const audioPlayback = document.getElementById('audio-playback');
const playPauseBtn = document.getElementById('custom-play-pause-btn');
const seekBar = document.getElementById('custom-seek-bar');
const currentTimeDisplay = document.getElementById('current-time');
const totalTimeDisplay = document.getElementById('total-time');

function prepareCustomPlayer(src) {
    audioPlayback.src = src;
    seekBar.value = 0;
    playPauseBtn.innerText = '▶️';
    currentTimeDisplay.innerText = '00:00';
    totalTimeDisplay.innerText = '00:00';

    audioPlayback.onloadedmetadata = () => {
        totalTimeDisplay.innerText = formatTime(audioPlayback.duration);
        seekBar.max = Math.floor(audioPlayback.duration);
    };

    audioPlayback.ontimeupdate = () => {
        seekBar.value = audioPlayback.currentTime;
        currentTimeDisplay.innerText = formatTime(audioPlayback.currentTime);
    };

    audioPlayback.onended = () => { playPauseBtn.innerText = '▶️'; audioPlayback.currentTime = 0; };
}

playPauseBtn.addEventListener('click', () => {
    if (audioPlayback.paused) { audioPlayback.play(); playPauseBtn.innerText = '⏸️'; } 
    else { audioPlayback.pause(); playPauseBtn.innerText = '▶️'; }
});

seekBar.addEventListener('input', () => { audioPlayback.currentTime = seekBar.value; });

function formatTime(seconds) {
    if (isNaN(seconds) || !isFinite(seconds)) return "00:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// --- BASE64 DÖNÜŞTÜRÜCÜ VE GÖNDERİM ---
const sendAudioBtn = document.getElementById('send-audio-btn');
const cancelAudioBtn = document.getElementById('cancel-audio-btn');

sendAudioBtn.addEventListener('click', async () => {
    if (audioBlobUrl) {
        const originalText = sendAudioBtn.innerText;
        sendAudioBtn.innerText = "Yükleniyor⏳";
        sendAudioBtn.disabled = true;

        try {
            const response = await fetch(audioBlobUrl);
            const blob = await response.blob();

            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = async () => {
                const base64Audio = reader.result;
                await saveAndSendMessage(base64Audio, 'audio');
                
                sendAudioBtn.innerText = originalText;
                sendAudioBtn.disabled = false;
                closeAudioPreview();
            };
        } catch (error) {
            alert("Ses gönderilirken hata: " + error.message);
            sendAudioBtn.innerText = originalText;
            sendAudioBtn.disabled = false;
        }
    }
});

cancelAudioBtn.addEventListener('click', () => { closeAudioPreview(); });

function closeAudioPreview() {
    audioPlayback.pause();
    audioPreviewContainer.classList.add('hidden');
    audioPlayback.src = '';
    audioBlobUrl = null;
    audioChunks = [];
}
