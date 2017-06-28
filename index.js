const viewWidth = window.innerWidth,// 视窗宽度
    viewHeight = window.innerHeight,// 视窗高度
    firstOffset = 10,// 首屏偏移量
    regImg = /^img$/i,// img标签正则
    isAndroid = /Android[\s\/][\d\.]+/.test(window.navigator.userAgent),
    defaultOptions = {
        mark: 'lazy',
        srcAttr: 'data-src',
        cache: true,
        autoDestroy: false,
        offset: {
            top: viewHeight,
            bottom: viewHeight,
            left: viewWidth,
            right: viewWidth
        }
    };// 默认配置
// inView 判断
const inView = (el, view) => {
    let elBox, elTop, elRight, elBottom, elLeft;
    elBox = el.getBoundingClientRect();
    return (elBottom = elBox.bottom) >= view.bottom &&
        (elTop = elBox.top) <= view.top &&
        (elRight = elBox.right) >= view.right &&
        (elLeft = elBox.left) <= view.left &&
        (elBottom || elTop || elRight || elLeft);
};
// class 操作
let classRegs = {};
const removeClass = (el, className) => {
    if (!(className in classRegs)) {
        classRegs[className] = new RegExp(`(\\s+|^)${className}(\\s+|$)`, 'g');
    }
    el.className = el.className.replace(classRegs[className], ' ').trim();
};
// 获取缓存
const getCache = (container, mark) => {
    return Array.prototype.slice.call((container === window ? document : container).querySelectorAll(`.${mark}`));
};
// 事件
const addEvent = (el, event, handel) => {
    if (document.addEventListener) {
        el.addEventListener(event, handel, false);
    } else {
        el.attachEvent('on' + event, handel);
    }
};
const removeEvent = (el, event, handel) => {
    if (document.removeEventListener) {
        el.removeEventListener(event, handel);
    } else {
        el.detachEvent('on' + event, handel);
    }
};
// 图片显示效果
const showImg = (img, src) => {
    if (!isAndroid) {
        img.style.cssText += ';opacity:0';
        let nextFunc = () => {
                img.style.cssText += ';-webkit-transition:.3s;transition:.3s;opacity:1';
            },
            oldLoad,
            oldError;
        if (typeof img.onload === 'function') {
            oldLoad = img.onload.bind(img);
            img.onload = () => {
                nextFunc();
                oldLoad();
            };
        } else {
            img.onload = nextFunc;
        }
        if (typeof img.onerror === 'function') {
            oldError = img.onerror.bind(img);
            img.onerror = () => {
                nextFunc();
                oldError();
            };
        } else {
            img.onerror = nextFunc;
        }
    }
    img.setAttribute('src', src);
};
export default
class Lazyload {
    constructor(container, options) {
        if (!container) {
            throw new Error('需要传入一个延迟加载容器');
        }
        this.container = container;
        if (typeof options !== 'object') {
            options = {};
        }
        let _options = this.options = {};
        for (let key in defaultOptions) {
            _options[key] = typeof options[key] !== 'undefined' ? options[key] : defaultOptions[key];
        }
        if (typeof _options.offset === 'number') {
            _options.offset = {
                top: _options.offset,
                bottom: _options.offset,
                left: _options.offset,
                right: _options.offset
            };
        }
        if (typeof _options.offset.top === 'undefined') {
            _options.offset.top = 0;
        }
        if (typeof _options.offset.bottom === 'undefined') {
            _options.offset.bottom = 0;
        }
        if (typeof _options.offset.left === 'undefined') {
            _options.offset.left = 0;
        }
        if (typeof _options.offset.right === 'undefined') {
            _options.offset.right = 0;
        }
        this.view = {
            top: viewHeight + firstOffset,
            bottom: -firstOffset,
            left: viewWidth + firstOffset,
            right: -firstOffset
        };// 偏移量计算结果
        this.finishFirst = false;// 是否完成首屏加载
        this.isDestroy = false;// 是否已经销毁
        this.timer = null;// 事件节流定时任务
        this.running = false;// 事件是否进行中
        this.finishTime = Date.now();// 上次事件完成时间
        if (_options.cache) {
            this.cache = getCache(container, _options.mark);// 缓存节点
        } else {
            this.cache = [];
        }
        this._debounce();
        let that = this;
        this.handel = () => {
            that._throttled();
        };
        addEvent(container, 'scroll', this.handel);
    }
    update() {
        let _options = this.options;
        if (this.isDestroy) {
            return false;
        }
        if (_options.cache) {
            this.cache = getCache(this.container, _options.mark);// 缓存节点
        }
        this._throttled();
        return true;
    }
    destroy() {
        removeEvent(this.container, 'scroll', this.handel);
        clearTimeout(this.timer);
        this.timer = null;
        this.running = false;
        this.cache = null;
        this.isDestroy = true;
    }
    _loadImg() {
        let _cache = this.cache,
            _options = this.options,
            _container = (this.container === window ? document : this.container),
            _view = this.view,
            _ary = _cache.length ? _cache : _container.querySelectorAll(`.${_options.mark}`);
        let _index = 0, _len = _ary.length;
        while (_index < _len) {
            let val = _ary[_index],
                origin = val.getAttribute(_options.srcAttr);
            if (!origin) {
                _ary.splice(_index, 1);
                _len--;
            } else if (inView(val, _view)) {
                if (regImg.test(val.nodeName)) {
                    showImg(val, origin.trim());
                } else {
                    val.style.backgroundImage = `url(${origin})`;
                }
                removeClass(val, _options.mark);
                val.removeAttribute(_options.srcAttr);
                _ary.splice(_index, 1);
                _len--;
            } else {
                _index++;
            }
        }
        if (!this.finishFirst) {
            this.view = {
                top: viewHeight + _options.offset.bottom,
                bottom: -_options.offset.top,
                left: viewWidth + _options.offset.right,
                right: -_options.offset.left
            };
            this.finishFirst = true;
        }
        if (_cache.size < 1 && _options.autoDestroy) {
            this.destroy();
        }
    }
    _run() {
        let that = this;
        clearTimeout(that.timer);
        that._loadImg();
        that.finishTime = Date.now();
        setTimeout(() => {
            that.running = false;
        });
    }
    _debounce() {
        let that = this;
        clearTimeout(that.timer);
        that.running = true;
        that.timer = setTimeout(() => {
            that._run();
        }, 0);
    }
    _throttled() {
        let that = this,
            delay;
        if (!that.running) {
            clearTimeout(that.timer);
            that.running = true;
            delay = Date.now() - that.finishTime;
            if (delay > 300) {
                delay = 9;
            } else {
                delay = 99;
            }
            that.timer = setTimeout(() => {
                that._run();
            }, delay);
        }
    }
}
