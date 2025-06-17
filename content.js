// 唯一标识符前缀
const DS_PREFIX = 'ds-collapse-';
const USER_PARENT_CLASS = '_9663006'
const USER_MESSAGE_CLASS = 'fbb737a4'
const AI_PARENT_CLASS = '_4f9bf79'
const AI_MESSAGE_CLASS = 'ds-markdown'
// 深度思考组件的选择器
const DEEP_THINKING_CLASS = '_58a6d71';

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
    toggleCollapse(messageElement, true, true);
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

  // 在按钮组中添加折叠动作按钮
  addCollapseActionButton(parentContainer, messageElement);
}

// 切换折叠状态
function toggleCollapse(element, shouldCollapse, skipSave = false) {
  // 判断消息类型
  const isUser = isUserMessage(element);
  // 获取父级容器
  const parent = element.closest(`.${USER_PARENT_CLASS}, .${AI_PARENT_CLASS}`);
  // 获取按钮
  const topBtn = parent.querySelector(`.${DS_PREFIX}btn`);
  const actionBtn = parent.querySelector(`.${DS_PREFIX}action-btn`);
  if (!topBtn) return;

  if (shouldCollapse) { // 需要变成折叠状态
    element.classList.add(`${DS_PREFIX}collapsed`, 'ds-collapsed');
    topBtn.textContent = '展开';

    if (actionBtn) {
      actionBtn.classList.add('collapsed');
      actionBtn.title = '展开';
      actionBtn.querySelector('svg').innerHTML = `
        <path d="M19 13H5v-2h14v2z" fill="currentColor"/>
        <path d="M13 19v-14h-2v14h2z" fill="currentColor"/>
      `;
    }
    // 添加折叠指示器
    if (!parent.querySelector(`.${DS_PREFIX}indicator`)) {
      const indicator = document.createElement('div');
      indicator.className = `${DS_PREFIX}indicator ds-collapse-indicator`;
      indicator.textContent = '内容已折叠 - 点击展开按钮查看完整内容';
      parent.appendChild(indicator);
    }
  }
  else {
    element.classList.remove(`${DS_PREFIX}collapsed`, 'ds-collapsed');
    topBtn.textContent = '折叠';

    if (actionBtn) {
      actionBtn.classList.remove('collapsed');
      actionBtn.title = '折叠';
      actionBtn.querySelector('svg').innerHTML = `
        <path d="M19 13H5v-2h14v2z" fill="currentColor"/>
      `;
    }
    // 移除折叠指示器
    const indicator = parent.querySelector(`.${DS_PREFIX}indicator`);
    if (indicator) indicator.remove();
  }
  // 跳过保存以提高批量操作性能
  if (!skipSave) {
    setCollapseState(element.id, shouldCollapse);
  }
}

// 在按钮组中添加折叠按钮
function addCollapseActionButton(parentElement, messageElement) {
  const isUser = isUserMessage(messageElement)
  const buttonGroup = isUser ? parentElement.querySelector('._78e0558') : parentElement.querySelector('._965abe9');
  if (!buttonGroup || buttonGroup.querySelector(`.${DS_PREFIX}action-btn`)) return;

  // 创建折叠按钮
  const collapseBtn = document.createElement('div');
  collapseBtn.className = `${DS_PREFIX}action-btn ds-icon-button`;
  collapseBtn.tabIndex = 0;
  if (isUser) collapseBtn.style.marginLeft = '14px'
  collapseBtn.title = '折叠';
  collapseBtn.innerHTML = `
    <div class="ds-icon" style="font-size: 20px; width: 20px; height: 20px;">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M19 13H5v-2h14v2z" fill="currentColor"/>
      </svg>
    </div>
  `;

  // 添加到按钮组
  buttonGroup.appendChild(collapseBtn);

  // 点击事件
  collapseBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const shouldCollapse = !messageElement.classList.contains(`${DS_PREFIX}collapsed`);
    toggleCollapse(messageElement, shouldCollapse);
    await setCollapseState(messageElement.id, shouldCollapse);
  });

  // 初始状态
  getCollapseState(messageElement.id).then(isCollapsed => {
    if (isCollapsed) {
      collapseBtn.classList.add('collapsed');
      collapseBtn.title = '展开';
      collapseBtn.querySelector('svg').innerHTML = `
        <path d="M19 13H5v-2h14v2z" fill="currentColor"/>
        <path d="M13 19v-14h-2v14h2z" fill="currentColor"/>
      `;
    }
  });
}

// 显示一键折叠toast
function showFeedback(message) {
  const existing = document.querySelector('.ds-collapse-feedback');
  if (existing) existing.remove();

  const feedback = document.createElement('div');
  feedback.className = 'ds-collapse-feedback';
  feedback.textContent = message;
  document.body.appendChild(feedback);

  setTimeout(() => feedback.remove(), 2000);
}

// 一键折叠/展开消息
async function toggleAllMessages(shouldCollapse) {
  showFeedback(shouldCollapse ? '已折叠所有消息和深度思考' : '已展开所有消息');
  const messages = findMessageElements()

  // 先执行UI更新
  messages.forEach(message => {
    toggleCollapse(message, shouldCollapse, true); // 跳过单独保存
  });

  // 批量保存状态
  const states = {};
  messages.forEach(message => {
    if (message.id) {
      states[message.id] = shouldCollapse;
    }
  });
  if (shouldCollapse) {
    // 深度思考组件
    const deepThinkingComponents = document.querySelectorAll(`.${DEEP_THINKING_CLASS}`);
    deepThinkingComponents.forEach(component => {
      // 找到箭头
      var arrowEle = component.querySelector('._54f4262')
      if (arrowEle) {
        ///180是深度思考展开状态,0为折叠
        const isCollapse = arrowEle.style.transform != 'rotate(180deg)'
        if (!isCollapse) {
          component.click()
        }
      }

    });
  }

  await new Promise(resolve => {
    chrome.storage.local.set({ dsCollapseStates: states }, () => {
      resolve();
    });
  });
}

// 初始化观察器
function initObserver() {
  console.log('Setting up MutationObserver');
  let observerDebounce;
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // 使用确认的选择器
          const messages = node.querySelectorAll(`.${USER_MESSAGE_CLASS},.${AI_MESSAGE_CLASS}`);
          messages.forEach(msg => {
            const parent = msg.closest(`.${USER_PARENT_CLASS}, .${AI_PARENT_CLASS}`);
            if (parent) {
              addCollapseButton(msg);
              // 延迟确保按钮组已加载
              setTimeout(() => addCollapseActionButton(parent, msg), 100);
            }
          });
          // // 处理单独动态加载的按钮组
          // const buttonGroups = node.querySelectorAll?.('.ds-flex') || [];
          // buttonGroups.forEach(btnGroup => {
          //   const parent = btnGroup.closest(`.${USER_PARENT_CLASS}, .${AI_PARENT_CLASS}`);
          //   const message = parent?.querySelector(`.${USER_MESSAGE_CLASS},.${AI_MESSAGE_CLASS}`);
          //   if (parent && message && !btnGroup.querySelector(`.${DS_PREFIX}action-btn`)) {
          //     addCollapseActionButton(parent, message);
          //   }
          // });
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

// 添加消息监听
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.command) {
    case 'collapse-all':
      toggleAllMessages(true);
      break;
    case 'expand-all':
      toggleAllMessages(false);
      break;
  }
});
