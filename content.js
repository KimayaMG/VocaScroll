// content.js

let isRecording = false;
let recognition = null;
let statusIndicator = null;
let lastNotification = null;

let scrollState = {
  isScrolling: false,
  isPaused: false,
  speed: 1.0, 
  direction: 1,
  intervalId: null,
  wasScrollingBeforeInactive: false
};

let shouldKeepListening = false;
let isTabActive = true;
let currentZoom = 1.0;
let lastCommandTime = 0;
const COMMAND_DEBOUNCE = 500; 
let isProcessingCommand = false;

// --- VOICE RECOGNITION LOGIC ---
function startRecognition() {
  if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
    showNotification('Speech recognition not supported', 'error');
    return;
  }

  if (!recognition) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      console.log('Speech recognition started');
      isRecording = true;
      updateStatusIndicator();
      showNotification('Voice activated - Listening...', 'info');
    };

    recognition.onresult = event => {
      console.log('Speech recognition result received');
      if (isProcessingCommand) {
        console.log('Already processing command, ignoring...');
        return;
      }

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim();
          console.log('Final transcript:', transcript);
          
          if (transcript && transcript.length > 0) {
            isProcessingCommand = true;
            console.log('Sending command to background:', transcript);
            
            chrome.runtime.sendMessage({
              action: 'executeCommand',
              command: transcript
            }, (response) => {
              console.log('Command response:', response);
              // Reset processing flag
              setTimeout(() => {
                isProcessingCommand = false;
                console.log('Command processing flag reset');
              }, COMMAND_DEBOUNCE);
            });
            break;
          }
        }
      }
    };

    recognition.onerror = event => {
      console.log('Speech recognition error:', event.error);
      isProcessingCommand = false;
      
      if (event.error !== 'no-speech' && event.error !== 'audio-capture') {
        showNotification(`Speech error: ${event.error}`, 'error');
      }
      
      isRecording = false;
      updateStatusIndicator();
      
      if (shouldKeepListening && !['not-allowed', 'aborted'].includes(event.error)) {
        setTimeout(() => {
          if (shouldKeepListening && isTabActive) {
            try { 
              console.log('Restarting recognition after error...');
              recognition.start(); 
            } catch (e) { 
              console.log('Error restarting recognition:', e);
            }
          }
        }, 1000);
      }
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      isRecording = false;
      updateStatusIndicator();
      
      if (shouldKeepListening && isTabActive) {
        setTimeout(() => {
          if (shouldKeepListening && isTabActive && !isProcessingCommand) {
            try { 
              console.log('Restarting recognition after end...');
              recognition.start(); 
            } catch (e) { 
              console.log('Error restarting recognition:', e);
            }
          }
        }, 500);
      }
    };
  }

  if (isRecording) {
    console.log('Recognition already running');
    return;
  }
  
  try {
    console.log('Starting speech recognition...');
    recognition.start();
    shouldKeepListening = true;
  } catch (error) {
    console.log('Recognition start error:', error);
    showNotification('Failed to start voice recognition', 'error');
  }
}

function stopRecognition() {
  console.log('Stopping recognition...');
  shouldKeepListening = false;
  isProcessingCommand = false;
  
  if (recognition && isRecording) {
    try { 
      recognition.stop(); 
    } catch (error) { 
      console.log('Error stopping recognition:', error);
    }
    isRecording = false;
    updateStatusIndicator();
    showNotification('Voice recognition stopped', 'info');
  }
}

// --- COMMAND HANDLER ---
function handleCommand(action, originalCommand) {
  console.log('Handling command:', action, 'Original:', originalCommand);
  
  // Fixed: Better debouncing logic
  const now = Date.now();
  if (now - lastCommandTime < COMMAND_DEBOUNCE) {
    console.log('Command debounced');
    return;
  }
  lastCommandTime = now;

  // Clear any existing notifications first 
  clearNotifications();

  if (action && action.startsWith('setScrollSpeed:')) {
    let spd = parseFloat(action.split(':')[1]);
    if (!isNaN(spd) && spd >= 0.5 && spd <= 5) {
      scrollState.speed = spd;
      updateStatusIndicator();
      showNotification(`Speed: ${spd.toFixed(1)}px/tick`, 'info');
      console.log('Speed set to:', spd);
    }
    return;
  }

  switch (action) {
    case 'startScrolling':
      console.log('Starting scrolling...');
      startScrolling();
      showNotification('Auto-scrolling started', 'success');
      break;
    case 'stopScrolling':
      console.log('Stopping scrolling...');
      stopScrolling();
      showNotification('Auto-scrolling stopped', 'info');
      break;
    case 'pauseScrolling':
      console.log('Toggling pause...');
      pauseScrolling();
      showNotification(scrollState.isPaused ? 'Scrolling paused' : 'Scrolling resumed', 'info');
      break;
    case 'resumeScrolling':
      console.log('Resuming scrolling...');
      resumeScrolling();
      showNotification('Auto-scrolling resumed', 'success');
      break;
    case 'increaseSpeed':
      changeSpeed(0.5);
      showNotification(`Speed: ${scrollState.speed.toFixed(1)}px/tick`, 'info');
      break;
    case 'decreaseSpeed':
      changeSpeed(-0.5);
      showNotification(`Speed: ${scrollState.speed.toFixed(1)}px/tick`, 'info');
      break;
    case 'scrollUp':
      scrollState.direction = -1;
      updateStatusIndicator();
      showNotification('Direction: Scrolling up', 'info');
      break;
    case 'scrollDown':
      scrollState.direction = 1;
      updateStatusIndicator();
      showNotification('Direction: Scrolling down', 'info');
      break;
    case 'goToTop':
      stopScrolling();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      showNotification('Scrolled to top', 'info');
      break;
    case 'goToBottom':
      stopScrolling();
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
      showNotification('Scrolled to bottom', 'info');
      break;
    case 'leftTab':
      chrome.runtime.sendMessage({ action: 'switchTab', direction: 'left' });
      showNotification('Switched to left tab', 'info');
      break;
    case 'rightTab':
      chrome.runtime.sendMessage({ action: 'switchTab', direction: 'right' });
      showNotification('Switched to right tab', 'info');
      break;
    case 'pauseVideo':
      controlVideo('pause');
      break;
    case 'playVideo':
      controlVideo('play');
      break;
    case 'maximizeVideo':
      controlVideo('maximize');
      break;
    case 'minimizeVideo':
      controlVideo('minimize');
      break;
    case 'maximizeWindow':
      chrome.runtime.sendMessage({ action: 'maximizeWindow' });
      showNotification('Window maximized', 'info');
      break;
    case 'minimizeWindow':
      chrome.runtime.sendMessage({ action: 'minimizeWindow' });
      showNotification('Window minimized', 'info');
      break;
    case 'stopListening':
    case 'goodbye':
      stopRecognition();
      showNotification('Voice recognition stopped', 'info');
      break;
    case 'goBack':
      window.history.back();
      showNotification('Navigated back', 'info');
      break;
    case 'goForward':
      window.history.forward();
      showNotification('Navigated forward', 'info');
      break;
    case 'refresh':
      location.reload();
      showNotification('Page refreshed', 'info');
      break;
    case 'zoomIn':
      adjustZoom(0.1);
      break;
    case 'zoomOut':
      adjustZoom(-0.1);
      break;
    case 'focusSearch':
      focusSearchBar();
      break;
    default:
      console.log('Unrecognized command:', action, originalCommand);
      if (originalCommand) showNotification(`Command not recognized: "${originalCommand}"`, 'warning');
  }
}

// --- VIDEO CONTROL LOGIC ---
function controlVideo(action) {
  let video = findBestVideo();

  if (!video) {
    showNotification('No video found', 'warning');
    return;
  }

  switch (action) {
    case 'pause':
      if (!video.paused) {
        video.pause();
        showNotification('Video paused', 'info');
      } else {
        showNotification('Video is already paused', 'info');
      }
      break;
    case 'play':
      if (video.paused) {
        const playPromise = video.play();
        if (playPromise) {
          playPromise.then(() => {
            showNotification('Video playing', 'info');
          }).catch(() => {
            showNotification('Failed to play video', 'error');
          });
        } else {
          showNotification('Video playing', 'info');
        }
      } else {
        showNotification('Video is already playing', 'info');
      }
      break;
    case 'maximize':
      maximizeVideo(video);
      break;
    case 'minimize':
      minimizeVideo(video);
      break;
  }
}

function findBestVideo() {
  // YouTube specific
  if (window.location.hostname.includes('youtube.com')) {
    return document.querySelector('video.html5-main-video') ||
      document.querySelector('.video-stream') ||
      document.querySelector('#movie_player video') ||
      document.querySelector('video');
  }

  // General video search
  const videos = Array.from(document.querySelectorAll('video'));
  if (videos.length === 0) return null;

  // Filter visible videos only
  const visibleVideos = videos.filter(video => {
    const rect = video.getBoundingClientRect();
    const style = window.getComputedStyle(video);
    return rect.width > 100 && rect.height > 100 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      video.offsetParent !== null;
  });

  if (visibleVideos.length === 0) return videos[0];

  // Sort by size and return largest
  return visibleVideos.sort((a, b) => {
    const aSize = a.videoWidth * a.videoHeight || a.clientWidth * a.clientHeight;
    const bSize = b.videoWidth * b.videoHeight || b.clientWidth * b.clientHeight;
    return bSize - aSize;
  })[0];
}

function maximizeVideo(video) {
  if (document.fullscreenElement) {
    showNotification('Already in fullscreen mode', 'info');
    return;
  }

  const requestFullscreen = video.requestFullscreen ||
    video.webkitRequestFullscreen ||
    video.mozRequestFullScreen ||
    video.msRequestFullscreen;

  if (requestFullscreen) {
    const promise = requestFullscreen.call(video);
    if (promise) {
      promise.then(() => {
        showNotification('Video maximized', 'info');
      }).catch((error) => {
        console.log('Fullscreen failed:', error);
        fallbackMaximize(video);
      });
    } else {
      showNotification('Video maximized', 'info');
    }
  } else {
    fallbackMaximize(video);
  }
}

function minimizeVideo(video) {
  if (document.fullscreenElement) {
    const exitFullscreen = document.exitFullscreen ||
      document.webkitExitFullscreen ||
      document.mozCancelFullScreen ||
      document.msExitFullscreen;

    if (exitFullscreen) {
      const promise = exitFullscreen.call(document);
      if (promise) {
        promise.then(() => {
          showNotification('Exited fullscreen', 'info');
        }).catch(() => {
          showNotification('Failed to exit fullscreen', 'error');
        });
      } else {
        showNotification('Exited fullscreen', 'info');
      }
    }
  } else {
    video.style.cssText = video.style.cssText.replace(/position\s*:\s*fixed[^;]*;?/gi, '')
      .replace(/top\s*:\s*0[^;]*;?/gi, '')
      .replace(/left\s*:\s*0[^;]*;?/gi, '')
      .replace(/width\s*:\s*100vw[^;]*;?/gi, '')
      .replace(/height\s*:\s*100vh[^;]*;?/gi, '')
      .replace(/z-index\s*:\s*2147483646[^;]*;?/gi, '');
    showNotification('Video minimized', 'info');
  }
}

function fallbackMaximize(video) {
  video.style.cssText += `
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    z-index: 2147483646 !important;
    object-fit: contain !important;
    background: black !important;
  `;
  showNotification('Video maximized (fallback mode)', 'info');
}

// --- ZOOM FUNCTIONS ---
function adjustZoom(delta) {
  currentZoom = parseFloat(document.body.style.zoom) || 1.0;
  currentZoom += delta;
  currentZoom = Math.max(0.3, Math.min(3.0, currentZoom));
  document.body.style.zoom = currentZoom.toString();
  
  const percentage = Math.round(currentZoom * 100);
  showNotification(`Zoom: ${percentage}%`, 'info');
}

// --- SEARCH FUNCTION ---
function focusSearchBar() {
  const searchSelectors = [
    'input[type="search"]',
    'input[aria-label*="search" i]',
    'input[placeholder*="search" i]',
    'input[name*="search" i]',
    'input[id*="search" i]',
    'input[class*="search" i]',
    '.search-box input',
    '#search-box input',
    '#search input'
  ];

  for (const selector of searchSelectors) {
    try {
      const inputs = document.querySelectorAll(selector);
      for (const input of inputs) {
        if (input.offsetParent !== null && input.type !== 'hidden') {
          input.focus();
          input.select();
          showNotification('Search input focused', 'info');
          return;
        }
      }
    } catch (e) { }
  }

  showNotification('No search input found', 'warning');
}

// --- SCROLL LOGIC ---
function autoScroll() {
  if (scrollState.intervalId || !scrollState.isScrolling) return;
  
  console.log('Starting auto scroll with speed:', scrollState.speed);
  scrollState.intervalId = setInterval(() => {
    if (!scrollState.isScrolling || scrollState.isPaused || !isTabActive) return;
    window.scrollBy(0, scrollState.speed * scrollState.direction);
  }, 20);
}

function startScrolling() {
  console.log('startScrolling called, current state:', scrollState.isScrolling);
  
  if (scrollState.isScrolling) {
    console.log('Already scrolling, ignoring...');
    return;
  }
  
  scrollState.isScrolling = true;
  scrollState.isPaused = false;
  scrollState.wasScrollingBeforeInactive = false;
  
  console.log('Scrolling state updated, calling updateStatusIndicator and autoScroll');
  updateStatusIndicator();
  autoScroll();
}

function stopScrolling() {
  console.log('stopScrolling called');
  scrollState.isScrolling = false;
  scrollState.isPaused = false;
  scrollState.wasScrollingBeforeInactive = false;
  
  if (scrollState.intervalId) {
    clearInterval(scrollState.intervalId);
    scrollState.intervalId = null;
    console.log('Scroll interval cleared');
  }
  updateStatusIndicator();
}

function pauseScrolling() {
  if (scrollState.isScrolling) {
    scrollState.isPaused = !scrollState.isPaused;
    console.log('Scroll paused state:', scrollState.isPaused);
    updateStatusIndicator();
  }
}

function resumeScrolling() {
  if (scrollState.isScrolling && scrollState.isPaused) {
    scrollState.isPaused = false;
    console.log('Scrolling resumed');
    updateStatusIndicator();
  }
}

function changeSpeed(delta) {
  scrollState.speed = Math.min(Math.max(0.5, scrollState.speed + delta), 5);
  console.log('Speed changed to:', scrollState.speed);
  updateStatusIndicator();
}

// --- STATUS INDICATOR ---
function createStatusIndicator() {
  if (statusIndicator) return;

  statusIndicator = document.createElement('div');
  statusIndicator.id = 'vocascroll-indicator';

  Object.assign(statusIndicator.style, {
    position: 'fixed',
    top: '15px',
    right: '15px',
    zIndex: '2147483647',
    background: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(8px)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '20px',
    padding: '8px 12px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: '13px',
    fontWeight: '500',
    color: '#1e293b',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    transition: 'all 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    opacity: '0.9',
    maxWidth: '200px',
    cursor: 'default',
    userSelect: 'none'
  });

  document.body.appendChild(statusIndicator);
}

function updateStatusIndicator() {
  if (!statusIndicator) createStatusIndicator();

  let status = 'Ready';
  let bgColor = 'rgba(255, 255, 255, 0.95)';
  let borderColor = 'rgba(59, 130, 246, 0.3)';
  let textColor = '#1e293b';

  if (isRecording && shouldKeepListening) {
    status = 'Listening...';
    bgColor = 'rgba(59, 130, 246, 0.95)';
    borderColor = 'rgba(59, 130, 246, 0.8)';
    textColor = 'white';
  } else if (scrollState.isScrolling) {
    if (scrollState.isPaused) {
      status = `Paused (${scrollState.speed.toFixed(1)}px/tick)`;
      bgColor = 'rgba(245, 158, 11, 0.95)';
      borderColor = 'rgba(245, 158, 11, 0.8)';
      textColor = 'white';
    } else {
      const direction = scrollState.direction === 1 ? '↓' : '↑';
      status = `${direction} ${scrollState.speed.toFixed(1)}px/tick`;
      bgColor = 'rgba(34, 197, 94, 0.95)';
      borderColor = 'rgba(34, 197, 94, 0.8)';
      textColor = 'white';
    }
  }

  statusIndicator.style.background = bgColor;
  statusIndicator.style.borderColor = borderColor;
  statusIndicator.style.color = textColor;
  statusIndicator.textContent = status;
}

// --- NOTIFICATION SYSTEM ---
function clearNotifications() {
  if (lastNotification && lastNotification.parentNode) {
    lastNotification.remove();
    lastNotification = null;
  }
}

function showNotification(message, type = 'info') {
  clearNotifications();

  const notif = document.createElement('div');
  lastNotification = notif;

  const colors = {
    info: 'rgba(59, 130, 246, 0.95)',
    success: 'rgba(34, 197, 94, 0.95)',
    error: 'rgba(239, 68, 68, 0.95)',
    warning: 'rgba(245, 158, 11, 0.95)'
  };

  notif.style.cssText = `
    position: fixed !important;
    top: 60px !important;
    right: 20px !important;
    z-index: 2147483647 !important;
    background: ${colors[type] || colors.info} !important;
    color: white !important;
    padding: 12px 16px !important;
    border-radius: 8px !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
    font-size: 13px !important;
    font-weight: 500 !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2) !important;
    backdrop-filter: blur(8px) !important;
    transform: translateX(100%) !important;
    opacity: 0 !important;
    transition: all 0.3s ease !important;
    max-width: 300px !important;
    word-wrap: break-word !important;
    pointer-events: none !important;
  `;

  notif.textContent = message;
  document.body.appendChild(notif);

  requestAnimationFrame(() => {
    notif.style.transform = 'translateX(0)';
    notif.style.opacity = '1';
  });

  setTimeout(() => {
    if (notif && notif.parentNode) {
      notif.style.transform = 'translateX(100%)';
      notif.style.opacity = '0';
      setTimeout(() => {
        if (notif && notif.parentNode) {
          notif.remove();
          if (lastNotification === notif) {
            lastNotification = null;
          }
        }
      }, 300);
    }
  }, 3000);
}

// --- KEYBOARD SHORTCUTS ---
let arrowKeyPresses = [];
const ARROW_KEY_TIMEOUT = 1500;

document.addEventListener('keydown', event => {
  if (event.key === 'ArrowDown') {
    const now = Date.now();
    arrowKeyPresses.push(now);
    arrowKeyPresses = arrowKeyPresses.filter(time => now - time < ARROW_KEY_TIMEOUT);

    if (arrowKeyPresses.length >= 3) {
      event.preventDefault();
      if (!isRecording) {
        console.log('Triple arrow down - starting recognition');
        startRecognition();
      } else {
        console.log('Triple arrow down - stopping recognition');
        stopRecognition();
      }
      arrowKeyPresses = [];
    }
  } else {
    arrowKeyPresses = [];
  }
});

// --- TAB VISIBILITY ---
document.addEventListener('visibilitychange', () => {
  isTabActive = !document.hidden;
  console.log('Tab visibility changed, active:', isTabActive);

  if (!isTabActive) {
    if (scrollState.isScrolling && !scrollState.isPaused) {
      scrollState.wasScrollingBeforeInactive = true;
      pauseScrolling();
    }
    if (shouldKeepListening && recognition && isRecording) {
      try {
        recognition.stop();
      } catch (e) { }
    }
  } else if (isTabActive) {
    if (scrollState.wasScrollingBeforeInactive) {
      scrollState.wasScrollingBeforeInactive = false;
      resumeScrolling();
    }
    if (shouldKeepListening && !isRecording) {
      setTimeout(() => {
        if (shouldKeepListening && isTabActive) {
          try {
            recognition.start();
          } catch (e) { }
        }
      }, 500);
    }
  }
});

// --- MESSAGE HANDLER ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Content script received message:', request.action);
  
  try {
    if (request.action === 'stopScrollingOnInactive') {
      if (scrollState.isScrolling && !scrollState.isPaused) {
        scrollState.wasScrollingBeforeInactive = true;
        pauseScrolling();
      }
      sendResponse({ success: true });
    } else if (request.action === 'resumeScrollingOnActive') {
      if (scrollState.wasScrollingBeforeInactive) {
        scrollState.wasScrollingBeforeInactive = false;
        resumeScrolling();
      }
      sendResponse({ success: true });
    } else if (request.action === 'stopRecognitionOnInactive') {
      if (recognition && isRecording) {
        try {
          recognition.stop();
        } catch (e) { }
      }
      sendResponse({ success: true });
    } else if (request.action === 'executeVoiceCommand') {
      console.log('Executing voice command:', request.command, 'Original:', request.originalCommand);
      handleCommand(request.command, request.originalCommand);
      sendResponse({ scrollState, success: true });
    } else if (request.action === 'getScrollState') {
      sendResponse({ scrollState, success: true });
    } else if (request.action === 'toggleRecording') {
      if (isRecording) {
        stopRecognition();
      } else {
        startRecognition();
      }
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.log('Message handler error:', error);
    sendResponse({ success: false, error: error.message });
  }

  return true; // Keep channel open for async response
});

// --- INITIALIZATION ---
try {
  // Initialize zoom from current zoom level
  currentZoom = parseFloat(document.body.style.zoom) || 1.0;

  console.log('VocaScroll content script initialized');
  createStatusIndicator();
  updateStatusIndicator();
} catch (error) {
  console.log('Initialization error:', error);
}

// --- CLEANUP ---
window.addEventListener('beforeunload', () => {
  console.log('Page unloading, cleaning up...');
  shouldKeepListening = false;
  isProcessingCommand = false;
  
  if (recognition && isRecording) {
    try { recognition.stop(); } catch (e) { }
  }
  clearNotifications();
});