// ======================
// 常量定义区
// ======================
const DS = {
  PREFIX: 'ds-collapse-',
  CLASSES: {
    COLLAPSED: 'ds-collapsed',
    INDICATOR: 'ds-collapse-indicator',
    BTN: 'ds-collapse-btn',
    ACTION_BTN: 'ds-collapse-action-btn',
    FEEDBACK: 'ds-collapse-feedback'
  }
};

const USER = {
  PARENT: '_9663006',
  MESSAGE: 'fbb737a4',
  BUTTON_GROUP: '_78e0558'
};

const AI = {
  PARENT: '_4f9bf79',
  MESSAGE: 'ds-markdown',
  BUTTON_GROUP: '_965abe9'
};

const DEEP_THINKING = {
  CONTAINER: '_58a6d71'
};

const CODE_BLOCK = {
  CONTAINER: 'md-code-block',
  BUTTON_GROUP: 'efa13877',
  COLLAPSE_BTN: 'code-block-collapse-btn'
};

const STORAGE_KEYS = {
  STATES: 'dsCollapseStates'
};

const URL_PATTERN = /([a-f0-9-]{36})/i;

// ======================
// 核心管理器
// ======================
const CollapseManager = {

  currentConversationId: getCurrentConversationId(),
  selectors: {
    userMessages: `.${USER.MESSAGE}`,
    aiMessages: `.${AI.MESSAGE}`,
    allMessages: `.${USER.MESSAGE}, .${AI.MESSAGE}`,
    buttonGroups: `.${USER.BUTTON_GROUP}, .${AI.BUTTON_GROUP}`,
    userParents: `.${USER.PARENT}`,
    aiParents: `.${AI.PARENT}`,
    allParents: `.${USER.PARENT}, .${AI.PARENT}`
  },
  // 初始化方法
  init() {
    // this.initSelectors();
    this.setupEventListeners();
    this.setupUrlChangeListener(); // 先设置URL监听

    // 延迟初始化确保DOM加载
    setTimeout(() => {
      this.initObserver();
      this.initMessagesForCurrentConversation();
    }, 300);
    console.log('DeepSeek Collapser initialized');
  },

  // 初始化选择器
  initSelectors() {
    this.selectors = {
      userMessages: `.${USER.MESSAGE}`,
      aiMessages: `.${AI.MESSAGE}`,
      allMessages: `.${USER.MESSAGE}, .${AI.MESSAGE}`,
      buttonGroups: `.${USER.BUTTON_GROUP}, .${AI.BUTTON_GROUP}`,
      userParents: `.${USER.PARENT}`,
      aiParents: `.${AI.PARENT}`,
      allParents: `.${USER.PARENT}, .${AI.PARENT}`
    };
  },

  // 设置事件监听器
  setupEventListeners() {
    chrome.runtime.onMessage.addListener(this.toggleAllMessagesListener.bind(this));
  },

  // 键盘快捷键监听器
  toggleAllMessagesListener(request, sender, sendResponse) {
    switch (request.command) {
      case 'collapse-all': this.toggleAllMessages(true); break;
      case 'expand-all': this.toggleAllMessages(false); break;
    }
  },

  // 初始化观察器
  initObserver() {
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            this.handleNewElements(node);
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  },

  // 添加URL变化监听
  setupUrlChangeListener() {
    let lastConversationId = getCurrentConversationId();

    const checkUrlChange = () => {
      const currentId = getCurrentConversationId();
      if (currentId !== lastConversationId) {
        lastConversationId = currentId;
        this.handleConversationChange(currentId);
      }
      setTimeout(checkUrlChange, 500);
    };

    checkUrlChange();
  },

  // 处理对话切换
  handleConversationChange(newConversationId) {
    console.log(`Conversation changed to ${newConversationId}`);

    // 1. 清理旧消息的折叠状态
    document.querySelectorAll(`.${DS.PREFIX}btn`).forEach(btn => btn.remove());

    // 2. 初始化新对话的消息
    this.initMessagesForCurrentConversation();
  },

  // 初始化当前对话消息
  initMessagesForCurrentConversation() {
    // 处理现有消息
    document.querySelectorAll(this.selectors.allMessages).forEach(msg => {
      this.processMessageElement(msg);
    });

    // 设置重试机制处理动态加载
    let attempts = 0;
    const maxAttempts = 5;

    const tryInit = () => {
      const unprocessed = Array.from(document.querySelectorAll(this.selectors.allMessages))
        .filter(msg => !msg.id);

      if (unprocessed.length === 0 || attempts >= maxAttempts) return;

      attempts++;
      unprocessed.forEach(msg => this.processMessageElement(msg));
      setTimeout(tryInit, 300 * attempts);
    };

    tryInit();
  },

  // 处理新元素
  handleNewElements(node) {
    // 处理新消息
    const messages = node.querySelectorAll(this.selectors.allMessages);
    messages.forEach(msg => this.processMessageElement(msg));

    // 处理已有消息但未初始化的情况
    if (node.matches(this.selectors.allParents)) {
      const message = node.querySelector(this.selectors.allMessages);
      if (message) this.processMessageElement(message);
    }
  },

  // 处理消息元素
  async processMessageElement(messageElement) {
    const parent = messageElement.closest(this.selectors.allParents);
    if (!parent) return;

    // 确保有ID
    messageElement.id = messageElement.id || this.generateMessageId(messageElement);

    // 添加右上角折叠按钮
    this.addCollapseButton(parent, messageElement);
    // 添加按钮组按钮
    this.addCollapseActionButton(parent, messageElement)
    // 消息内各代码块添加折叠按钮
    this.addCodeBlocksButton(parent);

    // 恢复该消息的状态
    StateStorageManager.getCollapseState(messageElement.id).then(isCollapsed => {
      this.toggleCollapse(messageElement, isCollapsed, { isInitializing: true });
    });
  },

  // ======================
  // 核心功能方法
  // ======================

  // 生成消息ID
  generateMessageId(element) {
    if (element.id) return

    const isUser = element.classList.contains(USER.MESSAGE);
    if (isUser) {
      const userMessages = document.querySelectorAll(this.selectors.userMessages);
      const index = Array.from(userMessages).indexOf(element);
      return `${DS.PREFIX}${index}-A-USER`;
    }
    else {
      const aiMessages = document.querySelectorAll(this.selectors.aiMessages);
      const index = Array.from(aiMessages).indexOf(element);
      return `${DS.PREFIX}${index}-B-AI`;
    }
  },

  // 添加折叠按钮
  addCollapseButton(parent, messageElement) {
    // 检查是否已添加按钮
    if (parent.querySelector(`.${DS.CLASSES.BTN}`)) return;

    const btn = document.createElement('button');
    btn.className = DS.CLASSES.BTN;
    btn.textContent = '折叠';
    btn.dataset.targetId = messageElement.id;
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const shouldCollapse = !messageElement.classList.contains(DS.CLASSES.COLLAPSED);
      this.toggleCollapse(messageElement, shouldCollapse);
    });

    parent.appendChild(btn);
  },

  // 添加折叠动作按钮
  addCollapseActionButton(parent, messageElement) {
    const buttonGroup = parent.querySelector(this.selectors.buttonGroups);
    if (!buttonGroup || buttonGroup.querySelector(`.${DS.CLASSES.ACTION_BTN}`)) return;

    const btn = document.createElement('div');
    btn.className = `${DS.CLASSES.ACTION_BTN} ds-icon-button`;
    btn.tabIndex = 0;
    btn.title = '折叠';

    const isUser = messageElement.classList.contains(USER.MESSAGE);
    if (isUser) btn.style.marginLeft = '14px';

    btn.innerHTML = `
      <div class="ds-icon" style="font-size: 20px; width: 20px; height: 20px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19 13H5v-2h14v2z" fill="currentColor"/>
        </svg>
      </div>
    `;

    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const shouldCollapse = !messageElement.classList.contains(DS.CLASSES.COLLAPSED);
      this.toggleCollapse(messageElement, shouldCollapse);
    });

    buttonGroup.appendChild(btn);
  },

  // 处理代码块
  addCodeBlocksButton(parentElement) {
    const codeBlocks = parentElement.querySelectorAll(`.${CODE_BLOCK.CONTAINER}`);
    codeBlocks.forEach(block => {
      this.addCodeBlockCollapseButton(block);
    });
  },

  // 添加代码块折叠按钮
  addCodeBlockCollapseButton(codeBlock) {
    const buttonGroup = codeBlock.querySelector(`.${CODE_BLOCK.BUTTON_GROUP}`);
    if (!buttonGroup || buttonGroup.querySelector(`.${CODE_BLOCK.COLLAPSE_BTN}`)) return;

    const btn = document.createElement('div');
    btn.className = `${CODE_BLOCK.COLLAPSE_BTN} ds-button ds-button--secondary ds-button--borderless ds-button--rect ds-button--m _7db3914`;
    btn.tabIndex = 0;
    btn.style.marginLeft = '8px';
    btn.style.fontSize = '13px';
    btn.style.height = '28px';
    btn.style.padding = '0px 4px';
    btn.style.setProperty('--button-text-color', 'var(--dsr-text-2)');

    btn.innerHTML = `
      <div class="ds-button__icon">
        <div class="ds-icon icon" style="font-size: 16px; width: 16px; height: 16px;">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M7 10l5 5 5-5H7z" fill="currentColor"/>
          </svg>
        </div>
      </div>
      <span class="code-info-button-text">折叠</span>
    `;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isCollapsed = codeBlock.classList.toggle('collapsed');
      btn.querySelector('.code-info-button-text').textContent = isCollapsed ? '展开' : '折叠';
      btn.classList.toggle('collapsed', isCollapsed);
    });

    // 增加按钮
    buttonGroup.appendChild(btn);
  },

  // 更新按钮组按钮状态
  updateActionButtonState(button, isCollapsed) {
    if (!button) return;

    button.classList.toggle('collapsed', isCollapsed);
    button.title = isCollapsed ? '展开' : '折叠';

    // 有svg的是底部按钮组的按钮
    const svg = button.querySelector('svg');
    if (svg) {
      svg.innerHTML = isCollapsed
        ? `<path d="M19 13H5v-2h14v2z" fill="currentColor"/>
           <path d="M13 19v-14h-2v14h2z" fill="currentColor"/>`
        : `<path d="M19 13H5v-2h14v2z" fill="currentColor"/>`;
    }
  },

  // 更新深度思考状态
  updateDeepThinkState(parent, shouldCollapse) {
    // 深度思考按钮
    const deepThinkBtn = parent.querySelector(`.${DEEP_THINKING.CONTAINER}`);
    if (!deepThinkBtn) return

    // 找到箭头
    var arrowEle = deepThinkBtn.querySelector('._54f4262')
    if (!arrowEle) return

    // 0deg是深度思考折叠状态, 180deg为深度思考展开状态
    const isExpand = arrowEle.style.transform == 'rotate(180deg)'
    // 如果应该折叠,并且当前为展开
    if (shouldCollapse && isExpand) deepThinkBtn.click()
  },

  // 切换折叠状态
  async toggleCollapse(element, shouldCollapse, options = {}) {
    const { skipSave = false, isInitializing = false } = options;
    const parent = element.closest(this.selectors.allParents);
    if (!parent) return;

    // 更新消息UI状态
    element.classList.toggle(DS.CLASSES.COLLAPSED, shouldCollapse);

    // 获取按钮
    const topBtn = parent.querySelector(`.${DS.CLASSES.BTN}`);
    const actionBtn = parent.querySelector(`.${DS.CLASSES.ACTION_BTN}`);

    // 切换右上方按钮状态
    if (topBtn) topBtn.textContent = shouldCollapse ? '展开' : '折叠';
    // 切换按钮组按钮状态
    this.updateActionButtonState(actionBtn, shouldCollapse);
    // 切换深度思考状态
    this.updateDeepThinkState(parent, shouldCollapse)

    // 处理折叠指示器
    if (shouldCollapse) {
      if (!parent.querySelector(`.${DS.CLASSES.INDICATOR}`)) {
        const indicator = document.createElement('div');
        indicator.className = DS.CLASSES.INDICATOR;
        indicator.textContent = '内容已折叠 - 点击展开按钮查看完整内容';
        parent.appendChild(indicator);
      }
    } else {
      const indicator = parent.querySelector(`.${DS.CLASSES.INDICATOR}`);
      if (indicator) indicator.remove();
    }

    // 非指定跳过且非初始化时,才保存
    if (!skipSave && !isInitializing) {
      await StateStorageManager.setCollapseState(element.id, shouldCollapse, getCurrentConversationId());
    }
  },

  // 一键折叠/展开所有
  async toggleAllMessages(shouldCollapse) {
    this.showFeedback(shouldCollapse ? '已折叠所有消息和深度思考' : '已展开所有消息');

    // 1. 先执行所有UI更新
    const messages = document.querySelectorAll(this.selectors.allMessages);
    messages.forEach(msg => this.toggleCollapse(msg, shouldCollapse, { skipSave: true }));

    // 2. 收集所有状态后单次存储
    const newStates = {};
    messages.forEach(msg => {
      newStates[msg.id] = shouldCollapse;
    });

    // 3. 单次写入（原子操作）
    await StateStorageManager.setCollapseStates(newStates, getCurrentConversationId());
  },

  // 显示反馈提示
  showFeedback(message) {
    const existing = document.querySelector(`.${DS.CLASSES.FEEDBACK}`);
    if (existing) existing.remove();

    const feedback = document.createElement('div');
    feedback.className = DS.CLASSES.FEEDBACK;
    feedback.textContent = message;
    document.body.appendChild(feedback);

    setTimeout(() => feedback.remove(), 2000);
  },
}

// ======================
// 存储管理器
// ======================
const StateStorageManager = {
  // 获取存储键名
  getStorageKey(conversationId = getCurrentConversationId()) {
    return `${STORAGE_KEYS.STATES}_${conversationId}`;
  },

  // 获取当前对话的所有状态
  async getCollapseStates(conversationId) {
    return new Promise(resolve => {
      const storageKey = this.getStorageKey(conversationId)
      chrome.storage.local.get([storageKey], result => {
        resolve(result[storageKey] || {});
      });
    });
  },

  // 获取单个消息状态
  async getCollapseState(id, conversationId) {
    const states = await this.getCollapseStates(conversationId);
    return states[id] || false;
  },

  // 设置单个消息状态
  async setCollapseState(id, state, conversationId) {
    const current = await this.getCollapseStates(conversationId);
    return new Promise(resolve => {
      const storageKey = this.getStorageKey(conversationId)
      chrome.storage.local.set({ [storageKey]: { ...current, [id]: state } }, resolve);
    });
  },

  // 批量设置状态
  async setCollapseStates(states, conversationId) {
    const current = await this.getCollapseStates(conversationId);
    return new Promise(resolve => {
      chrome.storage.local.set({
        [this.getStorageKey(conversationId)]: { ...current, ...states }
      }, resolve);
    });
  },

  // 清除某个对话的状态
  async clearConversationStates(conversationId) {
    return new Promise(resolve => {
      const storageKey = this.getStorageKey(conversationId)
      chrome.storage.local.remove(storageKey, resolve);
    });
  }
};

// 获取当前对话UUID
function getCurrentConversationId() {
  const match = window.location.pathname.match(URL_PATTERN);
  return match ? match[1] : 'default';
}


// ======================
// 初始化入口
// ======================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => CollapseManager.init());
} else {
  CollapseManager.init();
}