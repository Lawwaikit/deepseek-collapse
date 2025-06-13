// 唯一标识符前缀
const DS_PREFIX = 'ds-collapse-';
const USER_PARENT_CLASS = '_9663006'
const USER_MESSAGE_CLASS = 'fbb737a4'
const AI_PARENT_CLASS = '_4f9bf79'
const AI_MESSAGE_CLASS = 'ds-markdown'


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
      resolve(states[id] || false);
    });
  });
}

// 更新ID生成逻辑
function generateMessageId(element) {
  // 用户消息：使用固定class + 索引
  if (isUserMessage(element)) {
    const userMessages = document.querySelectorAll(`.${USER_MESSAGE_CLASS}`);
    const index = Array.from(userMessages).indexOf(element);
    return `${DS_PREFIX}user-${index}`;
  }
  else {
    // AI消息：使用内容hash
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
}

// 更新工具函数：识别用户消息
function isUserMessage(element) {
  // 方法1：检查特定class（即使看起来随机但实际稳定）
  if (element.classList.contains(USER_MESSAGE_CLASS)) return true;
  return false;
}

function findMessageElements() {
  // 用户问题选择器 (根据您提供的class)
  const userMessages = document.querySelectorAll(`.${USER_MESSAGE_CLASS}`);
  // AI回答选择器 (保持原有)
  const aiMessages = document.querySelectorAll(`.${AI_MESSAGE_CLASS}`);
  // 合并两个NodeList
  return [...userMessages, ...aiMessages];
}

// 为消息添加折叠按钮
async function addCollapseButton(messageElement) {
  // 判断消息类型
  const isUser = isUserMessage(messageElement);

  // 获取父级容器
  const parentContainer = messageElement.closest(`.${USER_PARENT_CLASS}, .${AI_PARENT_CLASS}`);
  if (!parentContainer) return;

  // 检查是否已添加按钮
  if (parentContainer.querySelector(`.${DS_PREFIX}btn`)) return;


  messageElement.id = messageElement.id || generateMessageId(messageElement);
  console.log('Adding button to:', messageElement.id, isUser ? 'USER' : 'AI');

  // 创建折叠按钮
  const btn = document.createElement('button');
  btn.className = `${DS_PREFIX}btn`;
  btn.textContent = '折叠';
  btn.dataset.targetId = messageElement.id;

  // 添加到父级容器
  parentContainer.appendChild(btn);

  // 恢复状态
  const isCollapsed = await getCollapseState(messageElement.id);
  // 如果恢复的状态是折叠,立马折叠
  if (isCollapsed) {
    toggleCollapse(messageElement, true);
  }

  // 添加点击事件
  btn.addEventListener('click', async function (e) {
    e.stopPropagation();
    const targetId = this.dataset.targetId;
    const targetElement = document.getElementById(targetId);
    if (!targetElement) {
      console.error('Target element not found');
      return;
    }
    //isCollapsed 当前折叠状态 newCollapsed 新折叠状态
    const isCollapsed = targetElement.classList.contains(`${DS_PREFIX}collapsed`);
    toggleCollapse(targetElement, !isCollapsed);
    await setCollapseState(targetElement.id, !isCollapsed);
  });
}

// 切换折叠状态
function toggleCollapse(element, shouldCollapse) {
  // 判断消息类型
  const isUser = isUserMessage(element);
  // 获取父级容器
  const parent = element.closest(`.${USER_PARENT_CLASS}, .${AI_PARENT_CLASS}`);
  console.log('Before classes:', element.classList.toString());
  // 获取按钮
  const btn = parent.querySelector(`.${DS_PREFIX}btn`);
  if (!btn) return;

  if (shouldCollapse) { // 需要变成折叠状态
    element.classList.add(`${DS_PREFIX}collapsed`, 'ds-collapsed');
    btn.textContent = '展开';

    if (!parent.querySelector(`.${DS_PREFIX}indicator`)) {
      const indicator = document.createElement('div');
      indicator.className = `${DS_PREFIX}indicator ds-collapse-indicator`;
      indicator.textContent = '内容已折叠 - 点击展开按钮查看完整内容';
      parent.appendChild(indicator);
    }
  }
  else {
    element.classList.remove(`${DS_PREFIX}collapsed`, 'ds-collapsed', 'ds-collapsed-user');
    btn.textContent = '折叠';

    // 移除折叠指示器
    const indicator = parent.querySelector(`.${DS_PREFIX}indicator`);
    if (indicator) indicator.remove();
  }

  // 保存状态
  setCollapseState(element.id, shouldCollapse);

  console.log('After classes:', element.classList.toString());
}

// 初始化观察器
function initObserver() {
  console.log('Setting up MutationObserver');

  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // 使用确认的选择器
          const messages = node.querySelectorAll(`.${USER_MESSAGE_CLASS},.${AI_MESSAGE_CLASS}`);
          messages.forEach(msg => {
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
  console.log('Initializing collapser with parent container approach...');

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
    const messages = findMessageElements();
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