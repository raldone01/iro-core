import wheel from "../ui/wheel.js";
import slider from "../ui/slider.js";
import dom from "../util/dom.js";

import iroColor from "./color.js";
import iroStyleSheet from "./stylesheet.js";

// When the user starts to interact with a color picker's UI, a referece to that coloPicker will be stored globally
let active = false;

// Global mousemove + touchmove event handler
dom.listen(document, ["mousemove", "touchmove"], function (e) {
  // If there is an active colorWheel, call its mousemove handler
  if (active) active._mouseMove(e);
});

// Global mouseup + touchend event handler
dom.listen(document, ["mouseup", "touchend"], function (e) {
  // If there is an active colorWheel, stop it from handling input and clear the active colorWheel reference
  if (active) {
    e.preventDefault();
    active._mouseTarget = false;
    active = false;
  }
});

/**
  * @desc Handle creating <canvas> elments for the UI
  * @param {Element} wrapper - DOM element to append all the canvas layers to
  * @param {Number} width - width of the layers
  * @param {Number} height - height of the layers
  * @param {Array} names - an array of layer names
  * @return {Object} - canvas and ctx objects for each layer, keyed by layer name
  * @access private
*/
function createLayers(wrapper, width, height, names) {
  // Make sure the canvas wrappe is position:relative
  // This is because we'll be using position:absolute to stack the canvas layers
  wrapper.style.cssText += "position:relative";
  // To support devices with hidpi screens, we scale the canvas so that it has more pixels, but still has the same size visually
  // This implementation is based on https://www.html5rocks.com/en/tutorials/canvas/hidpi/
  var pxRatio = devicePixelRatio || 1;
  // Multiply the visual width and height by the pixel ratio
  // These dimensions will be used as the internal pixel dimensions for the canvas
  var pxWidth = width * pxRatio;
  var pxHeight = height * pxRatio;
  // When we make new layers we'll add it to this object
  var ret = {};
  // Loop through each entry in `names` and create a layer with that name
  names.forEach(function (name, index) {
    // Create a new canvas and add it to the page
    var canvas = dom.append(wrapper, dom.create("canvas"));
    var ctx = canvas.getContext("2d");
    var style = canvas.style;
    // Set the internal dimensions for the canvas
    canvas.width = pxWidth;
    canvas.height = pxHeight;
    // Set the visual dimensions for the canvas
    style.cssText += "width:" + width + "px;" + "height" + height + "px";
    // Scale the canvas context to counter the manual scaling of the element
    ctx.scale(pxRatio, pxRatio);
    // Since we're creating multiple "layers" from seperate canvas we need them to be visually stacked ontop of eachother
    // Here, any layer that isn't the first will be forced to the same position relative to their wrapper element
    // The first layer isn't forced, so the space it takes up will still be considered in page layout
    if (index != 0) style.cssText += "position:absolute;top:0;left:0";
    ret[name] = {
      ctx,
      canvas
    };
  });
  return ret;
};

/**
  @constructor color wheel object
  @param {ElementOrString} el - a DOM element or the CSS selector for a DOM element to use as a container for the UI
  @param {Object} opts - options for this instance
*/
let colorWheel = function (el, opts) {
  if (!(this instanceof colorWheel)) return new colorWheel(el, opts);
  // If `el` is a string, use it to select an Element, else assume it's an element
  el = ("string" == typeof el) ? dom.$(el) : el;
  // Find the width and height for the UI
  // If not defined in the options, try the HTML width + height attributes of the wrapper, else default to 320
  var width = opts.width || parseInt(dom.attr(el, "width")) || 320;
  var height = opts.height || parseInt(dom.attr(el, "height")) || 320;
  // Create UI layers
  var layers = createLayers(el, width, height, ["main", "over"]);
  // Calculate layout variables
  var padding = opts.padding + 2 || 6,
      sliderMargin = opts.sliderMargin || 24,
      markerRadius = opts.markerRadius || 8,
      sliderHeight = opts.sliderHeight || (markerRadius * 2) + (padding * 2),
      bodyWidth = Math.min(height - sliderHeight - sliderMargin, width),
      leftMargin = (width - bodyWidth) / 2;
  var marker = {
    r: markerRadius
  };
  // Create UI elements
  this.ui = [
    new wheel(layers, {
      cX: leftMargin + (bodyWidth / 2),
      cY: bodyWidth / 2,
      r: bodyWidth / 2,
      rMax: (bodyWidth / 2) - (markerRadius + padding),
      marker: marker
    }),
    new slider(layers, {
      type: "v",
      x: leftMargin,
      y: bodyWidth + sliderMargin,
      w: bodyWidth,
      h: sliderHeight,
      r: sliderHeight / 2,
      marker: marker
    })
  ];
  this.el = el;
  this.layers = layers;
  // Create an iroStyleSheet for this colorWheel's CSS overrides
  this.stylesheet = new iroStyleSheet(opts.css || opts.styles || undefined);
  // Create an iroColor to store this colorWheel's selected color
  this.color = new iroColor(opts.color || "#fff");
  // Whenever the selected color changes, trigger a colorWheel update too
  this.color.watch(this._update.bind(this), true);
  this._mouseTarget = false;
  this._onChange = false;
  // Add handler for mousedown + touchdown events on this element
  dom.listen(el, ["mousedown", "touchstart"], this._mouseDown.bind(this));
};

colorWheel.prototype = {
  /**
    * @desc Tet a callback function that gets called whenever the selected color changes
    * @param {Function} callback The watch callback
    * @param {Boolean} callImmediately set to true if you want to call the callback as soon as it is added
  */
  watch: function (callback, callImmediately) {
    this._onChange = callback;
    if (callImmediately) callback(this.color);
  },

  /**
    * @desc Remove the watch callback
  */
  unwatch: function () {
    this.watch(null);
  },

  /**
    * @desc Get the local-space X and Y pointer position from an input event
    * @param {Event} e A mouse or touch event
    * @return {Object} x and y coordinates from the top-left of the UI
    * @access protected
  */
  _localPoint: function (e) {
    // Prevent default event behaviour, like scrolling
    e.preventDefault();
    // Detect if the event is a touch event by checking if it has the `touches` property
    // If it is a touch event, use the first touch input
    var point = e.touches ? e.changedTouches[0] : e,
        // Get the screen position of the UI
        rect = this.layers.main.canvas.getBoundingClientRect();
    // Convert the screen-space pointer position to local-space
    return {
      x: point.clientX - rect.left,
      y: point.clientY - rect.top
    };
  },

  /**
    * @desc Handle a pointer input at local-space point (x, y)
    * @param {Event} e A mouse or touch event
    * @return {Object} x and y coordinates from the top-left of the UI
    * @access protected
  */
  _input: function (x, y) {
    // Use the active UI element to handle translating the input to a change in the color
    this.color.set(this._mouseTarget.input(x, y));
  },

  /**
    * @desc mousedown event handler
    * @param {Event} e A mouse or touch event
    * @access protected
  */
  _mouseDown: function (e) {
    // Get the local-space position of the mouse input
    var point = this._localPoint(e),
        x = point.x,
        y = point.y;

    // Loop through each UI element and check if the point "hits" it
    this.ui.forEach((uiElement) => {
      // If the element is hit, this means the user has clicked the element and is trying to interact with it
      if (uiElement.checkHit(x, y)) {
        // Set a reference to this colorWheel instance so that the global event handlers know about it
        active = this;
        // Set an internal reference to the uiElement being interacted with, for other internal event handlers
        this._mouseTarget = uiElement;
        // Finally, use the position to update the picked color
        this._input(x, y);
      }
    });
  },

  /**
    * @desc mousemose event handler
    * @param {Event} e A mouse or touch event
    * @access protected
  */
  _mouseMove: function (e) {
    // If there is an active colorWheel (set in _mouseDown) then update the input as the user interacts with it
    if (active) {
      // Get the local-space position of the mouse input
      var point = this._localPoint(e);
      // Use the position to update the picker color
      this._input(point.x, point.y);
    }
  },

  /**
    * @desc update the selected color
    * @param {Object} newValue - the new HSV values
    * @param {Object} oldValue - the old HSV values
    * @param {Object} changes - booleans for each HSV channel: true if the new value is different to the old value, else false
    * @access protected
  */
  _update: function (newValue, oldValue, changes) {
    // Loop through each UI element and update it
    this.ui.forEach(function (uiElement) {
      uiElement.set(newValue, changes);
    });
    // Update the stylesheet too
    this.stylesheet.update(this.color);
  },
};

module.exports = colorWheel;
