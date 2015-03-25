/**
    @module loader
**/
game.module(
    'engine.loader'
)
.body(function() {
'use strict';

/**
    Dynamic loader for assets and audio files.
    @class Loader
    @constructor
    @param {Function|String} callback Callback function or scene name
**/
game.createClass('Loader', {
    /**
        Number of files loaded.
        @property {Number} loaded
    **/
    loaded: 0,
    /**
        Percent of files loaded.
        @property {Number} percent
    **/
    percent: 0,
    /**
        Is loader started.
        @property {Boolean} started
        @default false
    **/
    started: false,
    /**
        Total files to load.
        @property {Number} totalFiles
    **/
    totalFiles: 0,
    /**
        List of assets to load.
        @property {Array} assetQueue
        @private
    **/
    _assetQueue: [],
    /**
        List of audios to load.
        @property {Array} audioQueue
        @private
    **/
    _audioQueue: [],
    /**
        Callback for loader.
        @property {Function|String} _callback
        @private
    **/
    _callback: null,
    /**
        Is loader in dynamic mode.
        @property {Boolean} _dynamic
        @private
    **/
    _dynamic: true,
    /**
        @property {Object} _loaders
        @private
    **/
    _loaders: {
        png: 'Image',
        jpg: 'Image',
        jpeg: 'Image',
        json: 'JSON',
        fnt: 'Font'
    },
    _startTime: 0,
    _readyTime: 0,
    
    init: function(callback) {
        this.onComplete = callback;

        for (var i = 0; i < game.assetQueue.length; i++) {
            this._assetQueue.push(this._getPath(game.assetQueue[i]));
        }
        game.assetQueue.length = 0;

        if (game.Audio.enabled) {
            for (var i = 0; i < game.audioQueue.length; i++) {
                this._audioQueue.push(game.audioQueue[i]);
            }
            game.audioQueue.length = 0;
        }

        this.totalFiles = this._assetQueue.length + this._audioQueue.length;
        if (this.totalFiles === 0) this.percent = 100;
    },

    /**
        Called, when loader is started.
        @method onStart
    **/
    onStart: function() {
        if (this._dynamic) return;
        var barWidth = game.Loader.barWidth * game.scale;
        var barHeight = game.Loader.barHeight * game.scale;

        var barBg = new game.Graphics();
        barBg.beginFill(game.Loader.barBgColor);
        barBg.drawRect(0, 0, barWidth, barHeight);
        barBg.position.set((game.system.width - barWidth) / 2, (game.system.height - barHeight) / 2);
        barBg.addTo(this.stage);

        this.barFg = new game.Graphics();
        this.barFg.beginFill(game.Loader.barColor);
        this.barFg.drawRect(0, 0, barWidth, barHeight);
        this.barFg.position.set((game.system.width - barWidth) / 2, (game.system.height - barHeight) / 2);
        this.barFg.addTo(this.stage);
        this.onProgress();
    },

    /**
        Called, when file is loaded.
        @method onProgress
    **/
    onProgress: function() {
        if (this.barFg) this.barFg.scale.x = this.percent / 100;
    },

    /**
        Called, when loader is completed.
        @method onComplete
    **/
    onComplete: function() {
    },

    /**
        Start loader.
        @method start
    **/
    start: function() {
        this.started = true;
        if (typeof this.onComplete === 'string') this._dynamic = false;

        if (!this._dynamic) {
            this._startTime = game.Timer.time;
            if (game.tweenEngine) game.tweenEngine.removeAll();
            if (game.system.stage) game.system.stage.removeAll();
            this.stage = new game.Container();
            game.scene = this;
            if (!game.system._running) game.system._startRunLoop();
        }

        this.onStart();

        // Nothing to load
        if (this.percent === 100) this._ready();
        else this._startLoading();
    },

    /**
        @method _startLoading
        @private
    **/
    _startLoading: function() {
        for (var i = 0; i < this._assetQueue.length; i++) {
            var filePath = this._assetQueue[i];
            var fileType = filePath.split('?').shift().split('.').pop().toLowerCase();
            if (!this._loaders[fileType]) throw 'Unsupported file type ' + fileType;
            this['_load' + this._loaders[fileType]](filePath, this._progress.bind(this));
        }

        for (var i = 0; i < this._audioQueue.length; i++) {
            var audio = this._audioQueue[i];
            game.audio._load(audio, this._progress.bind(this));
        }
    },

    /**
        @method _loadImage
        @param {String} filePath
        @param {Function} callback
        @private
    **/
    _loadImage: function(filePath, callback) {
        game.BaseTexture.fromImage(filePath, callback);
    },

    /**
        @method _loadFont
        @param {String} filePath
        @param {Function} callback
        @private
    **/
    _loadFont: function(filePath, callback) {
        this._loadFile(filePath, this._parseXML, callback);
    },

    /**
        @method _loadJSON
        @param {String} filePath
        @param {Function} callback
        @private
    **/
    _loadJSON: function(filePath, callback) {
        this._loadFile(filePath, this._parseJSON, callback);
    },

    /**
        @method _loadFile
        @param {String} filePath
        @param {Function} callback
        @param {Function} loadCallback
        @private
    **/
    _loadFile: function(filePath, callback, loadCallback) {
        var request = new XMLHttpRequest();
        request.onload = callback.bind(this, request, loadCallback);
        request.open('GET', filePath, true);
        request.send();
    },

    /**
        @method _parseXML
        @param {XMLHttpRequest} request
        @param {Function} callback
        @private
    **/
    _parseXML: function(request, callback) {
        if (!request.responseText) throw 'Error loading XML';

        var responseXML = request.responseXML;
        if (!responseXML || /MSIE 9/i.test(navigator.userAgent) || navigator.isCocoonJS) {
            if (typeof window.DOMParser === 'function') {
                var domparser = new DOMParser();
                responseXML = domparser.parseFromString(request.responseText, 'text/xml');
            } else {
                var div = document.createElement('div');
                div.innerHTML = request.responseText;
                responseXML = div;
            }
        }

        var font = responseXML.getElementsByTagName('page')[0].getAttribute('file');
        var image = game._getFilePath(font);

        this._loadImage(image, this._parseFont.bind(this, responseXML, callback));
    },

    /**
        @method _parseFont
        @param {XML} data
        @param {Function} callback
        @private
    **/
    _parseFont: function(data, callback) {
        game.Font.fromData(data);
        callback();
    },

    /**
        @method _parseJSON
        @param {XMLHttpRequest} request
        @param {Function} callback
        @private
    **/
    _parseJSON: function(request, callback) {
        if (!request.responseText) throw 'Error loading JSON';

        var json = JSON.parse(request.responseText);
        if (json.frames) {
            // Spritesheet
            var image = game._getFilePath(json.meta.image);
            this._loadImage(image, this._parseSpriteSheet.bind(this, json, callback));
        }
        else {
            // TODO save json
            callback();
        }
    },

    /**
        @method _parseSpriteSheet
        @param {JSON} json
        @param {Function} callback
        @private
    **/
    _parseSpriteSheet: function(json, callback) {
        var image = game._getFilePath(json.meta.image);
        var baseTexture = game.BaseTexture.fromImage(image);
        var frames = json.frames;

        for (var i in frames) {
            var frame = frames[i].frame;
            var texture = new game.Texture(baseTexture, frame.x, frame.y, frame.w, frame.h);
            game.Texture.cache[i] = texture;
        }

        callback();
    },

    /**
        @method _progress
        @private
    **/
    _progress: function() {
        this.loaded++;
        this.percent = Math.round(this.loaded / this.totalFiles * 100);
        this.onProgress();
        if (this.percent === 100) this._ready();
    },

    /**
        @method _ready
        @private
    **/
    _ready: function() {
        if (game.system.hires || game.system.retina) {
            for (var i in game.Texture.cache) {
                if (i.indexOf('@' + game.scale + 'x') !== -1) {
                    game.Texture.cache[i.replace('@' + game.scale + 'x', '')] = game.Texture.cache[i];
                    delete game.Texture.cache[i];
                }
            }
        }

        if (this._dynamic) this.onComplete();
        else {
            var loadTime = game.Timer.time - this._startTime;
            var timeToWait = game.Loader.time - loadTime;
            // Show 100% for at least 100ms
            if (timeToWait < 100) timeToWait = 100;
            this._readyTime = game.Timer.time + timeToWait;
        }
    },

    /**
        @method _update
        @private
    **/
    _update: function() {
        if (this._dynamic) return;
        if (this.percent === 100 && game.Timer.time >= this._readyTime) {
            game.system.setScene(this.onComplete);
        }
        game.renderer._render(this.stage);
    },

    /**
        @method _getPath
        @private
    **/
    _getPath: function(path) {
        return game.system.retina || game.system.hires ? path.replace(/\.(?=[^.]*$)/, '@' + game.scale + 'x.') : path;
    }
});

game.addAttributes('Loader', {
    /**
        Minimum time to show loader (ms). Not used in dynamic mode.
        @attribute {Number} time
        @default 200
    **/
    time: 200,
    /**
        Loading bar background color.
        @attribute {String} barBg
        @default #515e73
    **/
    barBgColor: '#515e73',
    /**
        Loading bar color.
        @attribute {String} barColor
        @default #e6e7e8
    **/
    barColor: '#e6e7e8',
    /**
        Width of the loading bar.
        @attribute {Number} barWidth
        @default 200
    **/
    barWidth: 200,
    /**
        Height of the loading bar.
        @attribute {Number} barHeight
        @default 20
    **/
    barHeight: 20
});

});
