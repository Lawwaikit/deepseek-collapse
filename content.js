// 唯一标识符前缀
const DS_PREFIX = 'ds-collapse-';

// 增强的存储折叠状态函数
async function setCollapseState(id, isCollapsed) {
  try {
    // 获取当前所有状态
    const currentState = await new Promise(resolve => {
      chrome.storage.local.get(['dsCollapseStates'], result => {
        resolve(result.dsCollapseStates || {});
      });
    });

    // 更新状态
    const newState = { ...currentState, [id]: isCollapsed };

    // 保存新状态
    await new Promise(resolve => {
      chrome.storage.local.set({ dsCollapseStates: newState }, () => {
        console.log('State saved:', newState);
        resolve();
      });
    });
  } catch (error) {
    console.error('Storage error:', error);
  }
}

// 增强的获取折叠状态函数
async function getCollapseState(id) {
  return new Promise(resolve => {
    chrome.storage.local.get(['dsCollapseStates'], result => {
      const states = result.dsCollapseStates || {};
      console.log('Loaded states:', states);
      resolve(states[id] || false);
    });
  });
}
// 生成基于内容hash的稳定ID
function generateStableId(element) {
  const content = element.textContent.trim();
  if (!content) return DS_PREFIX + Math.random().toString(36).substr(2, 9);

  // 创建内容hash
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }

  return DS_PREFIX + Math.abs(hash).toString(36);
}



// 修改后的addCollapseButton函数
// 为消息添加折叠按钮
async function addCollapseButton(messageElement) {
  // 确保获取的是最外层容器
  const container = messageElement.closest('[class*="message-container"]') || messageElement;

  // 检查是否已经添加过按钮
  if (messageElement.querySelector(`.${DS_PREFIX}btn`)) {
    return;
  }

  // // 确保元素有ID，如果没有则生成一个
  // if (!messageElement.id) {
  //   messageElement.id = DS_PREFIX + Date.now() + Math.random().toString(36).substr(2, 9);
  // }

  // 使用稳定ID
  if (!messageElement.id) {
    messageElement.id = generateStableId(messageElement);
  }

  // 创建折叠按钮
  const btn = document.createElement('button');
  btn.className = `${DS_PREFIX}btn ds-collapse-btn`;
  btn.textContent = '折叠';
  btn.dataset.targetId = messageElement.id;

  // 添加到消息元素
  messageElement.style.position = 'relative';
  messageElement.appendChild(btn);

  // // 从存储中获取状态并应用
  // getCollapseState(messageElement.id).then(isCollapsed => {
  //   if (isCollapsed) {
  //     toggleCollapse(messageElement, true);
  //   }
  // });
  // 恢复状态
  const isCollapsed = await getCollapseState(messageElement.id);
  console.log(`Restoring state for ${messageElement.id}:`, isCollapsed);

  if (isCollapsed) {
    toggleCollapse(messageElement, true);
  } else {
    btn.textContent = '折叠';
  }

  // 添加点击事件
  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    console.log('Button clicked on:', this.dataset.targetId); // 调试日志
    const targetId = this.dataset.targetId;
    const targetElement = document.getElementById(targetId);
    if (!targetElement) {
      console.error('Target element not found');
      return;
    }
    const isCollapsed = targetElement.classList.contains(`${DS_PREFIX}collapsed`);
    toggleCollapse(targetElement, !isCollapsed);
  });
}

// 切换折叠状态
function toggleCollapse(element, shouldCollapse) {
  console.log(`Toggling collapse: ${shouldCollapse}`, element);
  console.log('Before classes:', element.classList.toString());

  const btn = element.querySelector(`.${DS_PREFIX}btn`);

  if (shouldCollapse) {
    element.classList.add(`${DS_PREFIX}collapsed`, 'ds-collapsed');
    btn.textContent = '展开';
    console.log('Element after adding classes:', element.classList);

    // 添加折叠指示器
    if (!element.querySelector(`.${DS_PREFIX}indicator`)) {
      const indicator = document.createElement('div');
      indicator.className = `${DS_PREFIX}indicator ds-collapse-indicator`;
      indicator.textContent = '内容已折叠 - 点击展开按钮查看完整内容';
      element.appendChild(indicator);
    }
  } else {
    element.classList.remove(`${DS_PREFIX}collapsed`, 'ds-collapsed');
    btn.textContent = '折叠';

    // 移除折叠指示器
    const indicator = element.querySelector(`.${DS_PREFIX}indicator`);
    if (indicator) {
      indicator.remove();
    }
    // 调试样式应用情况
    console.log('Current display style:', window.getComputedStyle(element).display);
    console.log('Current max-height:', window.getComputedStyle(element).maxHeight);
  }

  // 保存状态
  setCollapseState(element.id, shouldCollapse);

  console.log('After classes:', element.classList.toString());
  console.log('Computed style:', window.getComputedStyle(element).maxHeight);
}

// 初始化观察器
function initObserver() {
  console.log('Setting up MutationObserver');

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // 使用确认的选择器
          const messages = node.querySelectorAll ?
            node.querySelectorAll('[class*="ds-markdown ds-markdown--block"]') : [];

          messages.forEach(msg => {
            console.log('New message element detected', msg);
            addCollapseButton(msg);
          });
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  return observer;
}

// 主初始化函数
async function init() {
  console.log('Initializing DeepSeek Collapser');

  // 先加载所有存储状态
  const allStates = await new Promise(resolve => {
    chrome.storage.local.get(['dsCollapseStates'], result => {
      resolve(result.dsCollapseStates || {});
    });
  });
  console.log('All stored states:', allStates);

  // 设置重试机制
  const maxAttempts = 10;
  let attempts = 0;

  const checkContainer = setInterval(() => {
    // 使用您确认的正确选择器
    const messages = document.querySelectorAll('[class*="ds-markdown ds-markdown--block"]');
    attempts++;

    if (messages.length > 0 || attempts >= maxAttempts) {
      clearInterval(checkContainer);

      if (messages.length > 0) {
        console.log(`Found ${messages.length} message elements`);
        // 处理每条消息
        messages.forEach(async msg => {
          await addCollapseButton(msg);
        });
        // 初始化观察器
        initObserver();
      } else {
        console.error('Failed to find message elements');
      }
    }
  }, 500);
}

// 启动初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}