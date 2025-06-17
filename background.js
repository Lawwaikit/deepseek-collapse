// 处理快捷键命令
chrome.commands.onCommand.addListener((command) => {
  chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
    if (tabs[0] && tabs[0].id) {
      chrome.tabs.sendMessage(tabs[0].id, {command});
    }
  });
});