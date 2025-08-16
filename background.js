// background.js

let scrollState = {
  isScrolling: false,
  isPaused: false,
  speed: 1.0,
  direction: 'down'
};

let activeTabId = null;

class AICommandProcessor {
  constructor() {
    this.commands = {
      startScrolling: [
        'start scrolling', 'begin scrolling', 'auto scroll', 'scroll', 'start scroll',
        'begin scroll', 'commence scrolling', 'initiate scrolling', 'activate scrolling',
        'start auto scroll', 'begin auto scrolling'
      ],
      stopScrolling: [
        'stop scrolling', 'stop scroll', 'halt scroll', 'end scrolling', 'cease scrolling',
        'disable scrolling', 'turn off scrolling', 'quit scrolling', 'stop', 'end',
        'stop auto scroll', 'end auto scrolling', 'disable scroll', 'quit scroll'
      ],
      pauseScrolling: [
        'pause scrolling', 'pause scroll', 'hold scroll', 'suspend scrolling',
        'freeze scrolling', 'halt temporarily', 'pause', 'pause auto scroll'
      ],
      resumeScrolling: [
        'resume scrolling', 'continue scroll', 'unpause scroll', 'restart scrolling',
        'continue scrolling', 'resume scroll', 'resume', 'continue', 'unpause'
      ],
      increaseSpeed: [
        'scroll faster', 'speed up', 'increase scroll speed', 'faster', 'accelerate',
        'increase speed', 'speed up scrolling', 'make it faster', 'boost speed',
        'go faster', 'scroll quicker', 'quicken', 'faster scrolling'
      ],
      decreaseSpeed: [
        'scroll slower', 'slow down', 'reduce scroll speed', 'slower', 'decelerate',
        'decrease speed', 'slow down scrolling', 'make it slower', 'reduce speed',
        'go slower', 'scroll more slowly', 'slower scrolling'
      ],
      scrollUp: [
        'scroll up', 'reverse', 'go up', 'upward', 'scroll upward', 'move up',
        'direction up', 'scroll backwards', 'reverse direction'
      ],
      scrollDown: [
        'scroll down', 'normal direction', 'go down', 'downward', 'scroll downward',
        'move down', 'direction down', 'scroll forward', 'forward direction'
      ],
      goToTop: [
        'go to top', 'top of page', 'scroll to top', 'page top', 'jump to top',
        'beginning of page', 'start of page', 'top'
      ],
      goToBottom: [
        'go to bottom', 'bottom of page', 'scroll to bottom', 'page bottom',
        'jump to bottom', 'end of page', 'bottom'
      ],
      leftTab: [
        'go to left tab', 'left tab', 'previous tab', 'switch left', 'tab left',
        'move to left tab', 'switch to left tab', 'go left', 'previous'
      ],
      rightTab: [
        'go to right tab', 'right tab', 'next tab', 'switch right', 'tab right',
        'move to right tab', 'switch to right tab', 'go right', 'next'
      ],
      pauseVideo: [
        'pause video', 'pause the video', 'stop video', 'halt video',
        'freeze video', 'pause current video', 'video pause'
      ],
      playVideo: [
        'play video', 'resume video', 'start video', 'unpause video',
        'continue video', 'play the video', 'video play', 'start the video'
      ],
      maximizeVideo: [
        'maximize video', 'fullscreen video', 'expand video', 'full screen video',
        'make video fullscreen', 'video fullscreen', 'enlarge video'
      ],
      minimizeVideo: [
        'minimize video', 'shrink video', 'exit fullscreen', 'close fullscreen',
        'reduce video', 'small video', 'normal video size'
      ],
      maximizeWindow: [
        'maximize window', 'maximize browser', 'maximize browser window',
        'fullscreen browser', 'maximize', 'expand window', 'full screen',
        'make window bigger', 'enlarge window'
      ],
      minimizeWindow: [
        'minimize window', 'minimize browser', 'minimize browser window',
        'shrink browser', 'reduce window', 'make window smaller', 'minimize'
      ],
      stopListening: [
        'stop listening', 'stop voice', 'disable voice', 'turn off voice',
        'quit listening', 'stop voice control', 'disable listening'
      ],
      goodbye: [
        'bye', 'goodbye', 'good bye', 'see you later', 'farewell', 'stop everything'
      ],
      goBack: [
        'go back', 'back', 'previous page', 'history back', 'navigate back',
        'return', 'go to previous page', 'backward'
      ],
      goForward: [
        'go forward', 'forward', 'next page', 'history forward', 'navigate forward',
        'advance', 'go to next page'
      ],
      refresh: [
        'refresh', 'reload', 'refresh page', 'reload page', 'update page',
        'refresh the page', 'reload the page'
      ],
      zoomIn: [
        'zoom in', 'increase zoom', 'zoom closer', 'make bigger', 'enlarge',
        'zoom up', 'magnify'
      ],
      zoomOut: [
        'zoom out', 'decrease zoom', 'zoom farther', 'make smaller', 'shrink',
        'zoom back', 'reduce zoom'
      ],
      focusSearch: [
        'focus search', 'search bar', 'focus on search', 'search input',
        'search box', 'go to search', 'activate search', 'find search'
      ]
    };
  }

  processCommand(command) {
    const normalizedCommand = command.toLowerCase().trim();
    console.log('Processing command:', normalizedCommand);

    // First, try exact matches
    for (const [action, patterns] of Object.entries(this.commands)) {
      for (const pattern of patterns) {
        if (normalizedCommand === pattern) {
          console.log('Exact match found:', action, 'for pattern:', pattern);
          return action;
        }
      }
    }

    // Then try contains matches for multi-word patterns
    for (const [action, patterns] of Object.entries(this.commands)) {
      for (const pattern of patterns) {
        if (pattern.split(' ').length > 1 && normalizedCommand.includes(pattern)) {
          console.log('Contains match found:', action, 'for pattern:', pattern);
          return action;
        }
      }
    }

    // Finally try partial word matches
    for (const [action, patterns] of Object.entries(this.commands)) {
      for (const pattern of patterns) {
        const patternWords = pattern.split(' ');
        const commandWords = normalizedCommand.split(' ');
        
        // Check if all pattern words are found in command
        if (patternWords.every(word => 
          commandWords.some(cmdWord => 
            cmdWord.includes(word) || word.includes(cmdWord)
          )
        )) {
          console.log('Partial match found:', action, 'for pattern:', pattern);
          return action;
        }
      }
    }

    console.log('No match found for command:', normalizedCommand);
    return null;
  }
}

const commandProcessor = new AICommandProcessor();

// Enhanced tab management
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  activeTabId = activeInfo.tabId;

  try {
    const tabs = await chrome.tabs.query({});

    // Stop activities on inactive tabs
    for (const tab of tabs) {
      if (tab.id !== activeTabId) {
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'stopScrollingOnInactive' });
        } catch (e) {
          // Tab might not have content script loaded
        }
        try {
          await chrome.tabs.sendMessage(tab.id, { action: 'stopRecognitionOnInactive' });
        } catch (e) {
          // Tab might not have content script loaded
        }
      }
    }

    // Resume activity on active tab
    if (activeTabId !== null) {
      try {
        await chrome.tabs.sendMessage(activeTabId, { action: 'resumeScrollingOnActive' });
      } catch (e) {
        // Tab might not have content script loaded yet
      }
    }
  } catch (error) {
    console.log('Tab activation error:', error);
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === activeTabId) {
    activeTabId = null;
  }
});

// Enhanced message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action, request.command);

  const respond = (data) => {
    try {
      if (sendResponse) {
        sendResponse(data);
      }
    } catch (e) {
      console.log('Response error:', e);
    }
  };

  try {
    switch (request.action) {
      case "executeCommand":
        handleExecuteCommand(request, sender, respond);
        return true; // Keep channel open
        
      case "updateScrollState":
        scrollState = { ...scrollState, ...request.state };
        respond({ scrollState, success: true });
        break;

      case "getScrollState":
        respond({ scrollState, success: true });
        break;

      case "getActiveTabId":
        respond({ activeTabId, success: true });
        break;

      case "switchTab":
        handleSwitchTab(request, sender, respond);
        return true; // Keep channel open
        
      case "maximizeWindow":
        handleMaximizeWindow(sender, respond);
        return true; // Keep channel open
        
      case "minimizeWindow":
        handleMinimizeWindow(sender, respond);
        return true; // Keep channel open
        
      default:
        respond({ success: false, error: 'Unknown action' });
    }
  } catch (error) {
    console.log('Background script error:', error);
    respond({ success: false, error: error.message });
  }

  return false;
});

function handleExecuteCommand(request, sender, respond) {
  console.log('Executing command:', request.command);
  const action = commandProcessor.processCommand(request.command);
  
  if (action && sender.tab && sender.tab.id) {
    console.log('Sending action to content script:', action);
    chrome.tabs.sendMessage(sender.tab.id, {
      action: 'executeVoiceCommand',
      command: action,
      originalCommand: request.command
    }, (response) => {
      if (chrome.runtime.lastError) {
        console.log('Command execution error:', chrome.runtime.lastError);
        respond({ success: false, error: chrome.runtime.lastError.message });
      } else {
        console.log('Command executed successfully:', action);
        respond({ success: true, action: action, response: response });
      }
    });
  } else {
    console.log('Could not process command:', request.command, 'Action found:', action);
    respond({ success: false, error: 'Could not process command', action: action });
  }
}

async function handleSwitchTab(request, sender, respond) {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const currentIndex = tabs.findIndex(t => t.id === sender.tab.id);

    if (currentIndex === -1) {
      respond({ success: false, error: 'Current tab not found' });
      return;
    }

    let newIndex = currentIndex;
    if (request.direction === 'left') {
      newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (request.direction === 'right') {
      newIndex = (currentIndex + 1) % tabs.length;
    }

    if (newIndex !== currentIndex && tabs[newIndex]) {
      await chrome.tabs.update(tabs[newIndex].id, { active: true });
      respond({ success: true });
    } else {
      respond({ success: false, error: 'Could not switch tab' });
    }
  } catch (error) {
    respond({ success: false, error: error.message });
  }
}

async function handleMaximizeWindow(sender, respond) {
  try {
    const window = await chrome.windows.getCurrent();
    if (window.state !== 'maximized') {
      await chrome.windows.update(window.id, { state: 'maximized' });
      respond({ success: true });
    } else {
      respond({ success: true, message: 'Window already maximized' });
    }
  } catch (error) {
    respond({ success: false, error: error.message });
  }
}

async function handleMinimizeWindow(sender, respond) {
  try {
    const window = await chrome.windows.getCurrent();
    if (window.state !== 'minimized') {
      await chrome.windows.update(window.id, { state: 'minimized' });
      respond({ success: true });
    } else {
      respond({ success: true, message: 'Window already minimized' });
    }
  } catch (error) {
    respond({ success: false, error: error.message });
  }
}