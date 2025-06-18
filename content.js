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

const STORAGE_KEYS = {
  STATES: 'dsCollapseStates'
};

// ======================
// 核心管理器
// ======================
const CollapseManager = {
  // 初始化方法
  init() {
    this.initSelectors();
    this.setupEventListeners();
    this.initObserver();
    // 修改为延迟恢复状态
    setTimeout(() => this.restoreStates(), 500);
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

  // 运行时消息处理
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

  // 处理新元素
  handleNewElements(node) {
    // 处理新消息
    const messages = node.querySelectorAll(this.selectors.allMessages);
    messages.forEach(msg => this.processMessageElement(msg));

    // 处理新按钮组
    // const buttonGroups = node.querySelectorAll(this.selectors.buttonGroups);
    // buttonGroups.forEach(group => {
    //   const parent = group.closest(this.selectors.allParents);
    //   if (parent) {
    //     const message = parent.querySelector(this.selectors.allMessages);
    //     if (message) this.addCollapseActionButton(parent, message);
    //   }
    // });
  },

  // 处理消息元素
  async processMessageElement(messageElement) {
    const parent = messageElement.closest(this.selectors.allParents);
    if (!parent) return;

    // 确保有ID
    messageElement.id = messageElement.id || this.generateMessageId(messageElement);

    // 添加折叠按钮
    this.addCollapseButton(parent, messageElement);

    // 添加动作按钮
    this.addCollapseActionButton(parent, messageElement)
    // setTimeout(() => this.addCollapseActionButton(parent, messageElement), 100);

    this.getCollapseState(messageElement.id).then(isCollapsed => {
      if (isCollapsed) this.toggleCollapse(messageElement, true);
    });
  },

  // 恢复折叠状态
  async restoreStates() {
    const states = await this.getCollapseStates();
    const allMessages = document.querySelectorAll(this.selectors.allMessages)
    document.querySelectorAll(this.selectors.allMessages).forEach(msg => {
      if (states[msg.id]) {
        this.toggleCollapse(msg, true, { isInitializing: true, skipSave: true });
      }
    });
  },

  // ======================
  // 核心功能方法
  // ======================

  // 生成消息ID ok
  generateMessageId(element) {
    const isUser = element.classList.contains(USER.MESSAGE);
    // 用户消息：使用固定class + 索引
    if (isUser) {
      const userMessages = document.querySelectorAll(this.selectors.userMessages);
      const index = Array.from(userMessages).indexOf(element);
      return `ds-collapse-user-${index}`;
    }
    else {
      // AI消息使用内容hash
      const content = element.textContent.trim();
      let hash = 0;
      for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0;
      }
      return `ds-collapse-${Math.abs(hash).toString(36)}`;
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
    btn.addEventListener('click', (e) => {
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
      await this.setCollapseState(messageElement.id, shouldCollapse);
    });

    buttonGroup.appendChild(btn);

    // // 初始状态
    // this.getCollapseState(messageElement.id).then(isCollapsed => {
    //   if (isCollapsed) {
    //     this.updateButtonState(btn, true);
    //   }
    // });
  },

  // 更新按钮状态 ok
  updateButtonState(button, isCollapsed) {
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

  // 切换折叠状态
  async toggleCollapse(element, shouldCollapse, options = {}) {
    const { skipSave = false, isInitializing = false } = options;
    const parent = element.closest(this.selectors.allParents);
    if (!parent) return;

    // 更新UI状态
    element.classList.toggle(DS.CLASSES.COLLAPSED, shouldCollapse);

    // 更新按钮
    const topBtn = parent.querySelector(`.${DS.CLASSES.BTN}`);
    const actionBtn = parent.querySelector(`.${DS.CLASSES.ACTION_BTN}`);

    if (topBtn) topBtn.textContent = shouldCollapse ? '展开' : '折叠';
    this.updateButtonState(actionBtn, shouldCollapse);

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

    // 保存状态
    if (!skipSave) {
      await this.setCollapseState(element.id, shouldCollapse);
    }
  },

  // 一键折叠/展开所有
  async toggleAllMessages(shouldCollapse) {
    this.showFeedback(shouldCollapse ? '已折叠所有消息和深度思考' : '已展开所有消息');

    // 1. 先执行所有UI更新
    const messages = document.querySelectorAll(this.selectors.allMessages);
    messages.forEach(msg => {
      const currentState = msg.classList.contains(DS.CLASSES.COLLAPSED);
      if (currentState !== shouldCollapse) {
        this.toggleCollapse(msg, shouldCollapse, { skipSave: true });
      }
    });

    // 2. 收集所有状态后单次存储
    const newStates = {};
    messages.forEach(msg => {
      newStates[msg.id] = shouldCollapse;
    });

    // 3. 单次写入（原子操作）
    await this.setCollapseStates(newStates);
    // 4.处理深度思考组件（仅折叠时）
    if (shouldCollapse) {
      // 深度思考组件
      const deepThinkingComponents = document.querySelectorAll(`.${DEEP_THINKING.CONTAINER}`);
      deepThinkingComponents.forEach(component => {
        // 找到箭头
        var arrowEle = component.querySelector('._54f4262')
        if (arrowEle) {
          ///0是深度思考折叠状态,180为展开
          const isCollapse = arrowEle.style.transform == 'rotate(0deg)'
          if (!isCollapse) {
            component.click()
          }
        }
      });
    }
  },

  // 显示反馈提示 ok
  showFeedback(message) {
    const existing = document.querySelector(`.${DS.CLASSES.FEEDBACK}`);
    if (existing) existing.remove();

    const feedback = document.createElement('div');
    feedback.className = DS.CLASSES.FEEDBACK;
    feedback.textContent = message;
    document.body.appendChild(feedback);

    setTimeout(() => feedback.remove(), 2000);
  },

  // ======================
  // 存储相关方法
  // ======================

  async getCollapseStates() {
    return new Promise(resolve => {
      chrome.storage.local.get([STORAGE_KEYS.STATES], result => {
        resolve(result[STORAGE_KEYS.STATES] || {});
      });
    });
  },

  async getCollapseState(id) {
    const states = await this.getCollapseStates();
    return states[id] || false;
  },

  async setCollapseState(id, state) {
    const current = await this.getCollapseStates();
    return new Promise(resolve => {
      chrome.storage.local.set({
        [STORAGE_KEYS.STATES]: { ...current, [id]: state }
      }, resolve);
    });
  },

  // 新增批量存储方法
  async setCollapseStates(states) {
    const current = await this.getCollapseStates();
    return new Promise(resolve => {
      chrome.storage.local.set({
        [STORAGE_KEYS.STATES]: { ...current, ...states }
      }, resolve);
    });
  }
};

// ======================
// 初始化入口
// ======================
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => CollapseManager.init());
} else {
  CollapseManager.init();
}