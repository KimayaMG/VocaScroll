// popup.js

document.addEventListener('DOMContentLoaded', function () {
  console.log('Popup DOM loaded');

  function sendToActiveTab(msg, cb) {
    console.log('Sending message to active tab:', msg);
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        console.log('Query tabs error:', chrome.runtime.lastError);
        if (cb) cb({ error: chrome.runtime.lastError.message });
        return;
      }

      if (!tabs.length) {
        console.log('No active tab found');
        if (cb) cb({ error: 'No active tab found' });
        return;
      }

      console.log('Sending to tab:', tabs[0].id);
      chrome.tabs.sendMessage(tabs[0].id, msg, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Send message error:', chrome.runtime.lastError);
          if (cb) cb({ error: chrome.runtime.lastError.message });
          return;
        }
        console.log('Response received:', response);
        if (cb) cb(response || { success: true });
      });
    });
  }

  const startBtn = document.getElementById('startBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const stopBtn = document.getElementById('stopBtn');
  const speedSlider = document.getElementById('speedSlider');
  const speedValue = document.getElementById('speedValue');

  // Fixed: Set correct initial values
  if (speedSlider && speedValue) {
    speedSlider.value = '1.0';
    speedValue.textContent = '1.0x';
  }

  function updateScrollUI() {
    sendToActiveTab({ action: 'getScrollState' }, (response) => {
      console.log('Scroll state response:', response);
      
      if (response && response.scrollState && response.success) {
        const state = response.scrollState;
        console.log('Current scroll state:', state);

        if (startBtn && pauseBtn && stopBtn) {
          if (state.isScrolling) {
            startBtn.disabled = true;
            pauseBtn.disabled = false;
            stopBtn.disabled = false;

            if (state.isPaused) {
              pauseBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                Resume
              `;
            } else {
              pauseBtn.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
                Pause
              `;
            }
          } else {
            startBtn.disabled = false;
            pauseBtn.disabled = true;
            stopBtn.disabled = true;
            pauseBtn.innerHTML = `
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
              </svg>
              Pause
            `;
          }
        }

        if (speedSlider && speedValue) {
          speedSlider.value = state.speed.toString();
          speedValue.textContent = `${state.speed.toFixed(1)}x`;
        }
      }
    });
  }

  if (startBtn) {
    startBtn.addEventListener('click', () => {
      console.log('Start button clicked');
      
      sendToActiveTab({
        action: 'executeVoiceCommand',
        command: 'startScrolling',
        originalCommand: 'Start Scrolling'
      }, (response) => {
        console.log('Start scrolling response:', response);
        
        if (!response || response.error || !response.success) {
          console.log('Error starting scrolling:', response?.error);
          showError('Please refresh the page to use the extension');
        } else {
          console.log('Scrolling started successfully');
          setTimeout(updateScrollUI, 200); // Increased delay
        }
      });
    });
  }

  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => {
      console.log('Pause button clicked');
      
      sendToActiveTab({
        action: 'executeVoiceCommand',
        command: 'pauseScrolling',
        originalCommand: 'Pause Scrolling'
      }, (response) => {
        console.log('Pause scrolling response:', response);
        
        if (!response || response.error || !response.success) {
          console.log('Error pausing scrolling:', response?.error);
          showError('Please refresh the page to use the extension');
        } else {
          setTimeout(updateScrollUI, 200);
        }
      });
    });
  }

  if (stopBtn) {
    stopBtn.addEventListener('click', () => {
      console.log('Stop button clicked');
      
      sendToActiveTab({
        action: 'executeVoiceCommand',
        command: 'stopScrolling',
        originalCommand: 'Stop Scrolling'
      }, (response) => {
        console.log('Stop scrolling response:', response);
        
        if (!response || response.error || !response.success) {
          console.log('Error stopping scrolling:', response?.error);
          showError('Please refresh the page to use the extension');
        } else {
          setTimeout(updateScrollUI, 200);
        }
      });
    });
  }

  if (speedSlider && speedValue) {
    speedSlider.addEventListener('input', function () {
      console.log('Speed slider changed to:', this.value);
      
      speedValue.textContent = `${parseFloat(this.value).toFixed(1)}x`;
      
      sendToActiveTab({
        action: 'executeVoiceCommand',
        command: `setScrollSpeed:${this.value}`,
        originalCommand: `Set Speed ${this.value}`
      }, (response) => {
        console.log('Speed change response:', response);
        
        if (response && response.error) {
          console.log('Speed change error:', response.error);
          showError('Failed to change speed');
        }
      });
    });
  }

  function showError(message) {
    console.log('Showing error:', message);
    
    const existingError = document.querySelector('.popup-error');
    if (existingError) {
      existingError.remove();
    }

    const errorDiv = document.createElement('div');
    errorDiv.className = 'popup-error';
    errorDiv.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      right: 10px;
      background: var(--error-color, #ef4444);
      color: white;
      padding: 10px;
      border-radius: 6px;
      font-size: 12px;
      z-index: 1000;
      animation: slideIn 0.3s ease;
      text-align: center;
    `;
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);

    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.remove();
      }
    }, 4000);
  }

  // Check speech recognition support
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    console.log('Speech recognition not supported');
    showError('Speech recognition is not supported in this browser');
  } else {
    console.log('Speech recognition is supported');
  }

  // Add CSS if not exists
  if (!document.getElementById('popup-styles')) {
    const style = document.createElement('style');
    style.id = 'popup-styles';
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateY(-100%);
          opacity: 0;
        }
        to {
          transform: translateY(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // Initial UI update - with delay to ensure content script is ready
  console.log('Setting up initial UI update...');
  setTimeout(() => {
    console.log('Performing initial UI update...');
    updateScrollUI();
  }, 500);

  // Update UI periodically
  const updateInterval = setInterval(() => {
    console.log('Periodic UI update...');
    updateScrollUI();
  }, 3000);

  // Cleanup on unload
  window.addEventListener('unload', () => {
    console.log('Popup unloading, clearing interval');
    clearInterval(updateInterval);
  });
});