import handle from "./handle";
import base from "./base";

// css class prefix for this element
var CLASS_PREFIX = "iro__wheel";
// Quick references to reused math functions
var PI = Math.PI,
    sqrt = Math.sqrt,
    abs = Math.abs,
    round = Math.round;

export default class wheel extends base {
  /**
    * @constructor hue wheel UI
    * @param {svgRoot} svg - svgRoot object
    * @param {Object} opts - options
  */
  constructor(parent, opts) {
    super(parent, CLASS_PREFIX);
    this._opts = opts;
    this.type = "wheel";
  
    var cY = opts.cY,
        cX = opts.cX,
        r = opts.r,
        border = opts.border;
  
    var svg = parent.svg;
    var baseGroup = this.root;
  
    baseGroup.circle(cX, cY, r + border.w / 2, {
      class: CLASS_PREFIX + "__border",
      fill: "#fff",
      stroke: border.color,
      "stroke-width": border.w,
    });
  
    var ringGroup = baseGroup.g({
      class: CLASS_PREFIX + "__hue",
      "stroke-width": r,
      fill: "none",
    });
  
    for (var hue = 0; hue < 360; hue++) {
      ringGroup.arc(cX, cY, r / 2, hue, hue + 1.5, {
        stroke: "hsl(" + (opts.anticlockwise ? 360 - hue : hue) + ",100%,50%)",
      });
    }
  
    var saturation = baseGroup.circle(cX, cY, r, {
      class: CLASS_PREFIX + "__saturation"
    });
  
    saturation.setGradient("fill", svg.gradient("radial", {
      0: {
        color: "#fff"
      },
      100: {
        color:"#fff", 
        opacity: 0
      },
    }));
  
    this._lightness = baseGroup.circle(cX, cY, r, {
      class: CLASS_PREFIX + "__lightness",
      opacity: 0
    });
  
    this.handle = new handle(baseGroup, opts.marker);
  }

  /**
    * @desc updates this element to represent a new color value
    * @param {Object} color - an iroColor object with the new color value
    * @param {Object} changes - an object that gives a boolean for each HSV channel, indicating whether ot not that channel has changed
  */
  update(color, changes) {
    var opts = this._opts;
    var hsv = color.hsv;
    // If the V channel has changed, redraw the wheel UI with the new value
    if (changes.v && opts.lightness) {
      this._lightness.setAttrs({opacity: (1 - hsv.v / 100).toFixed(2) });
    }
    // If the H or S channel has changed, move the marker to the right position
    if (changes.h || changes.s) {
      // convert the hue value to radians, since we'll use it as an angle
      var hueAngle = (opts.anticlockwise ? 360 - hsv.h : hsv.h) * (PI / 180);
      // convert the saturation value to a distance between the center of the ring and the edge
      var dist = (hsv.s / 100) * opts.rMax;
      // Move the marker based on the angle and distance
      this.handle.move(opts.cX + dist * Math.cos(hueAngle), opts.cY + dist * Math.sin(hueAngle));
    }
  }

  /**
    * @desc Takes a point at (x, y) and returns HSV values based on this input -- use this to update a color from mouse input
    * @param {Number} x - point x coordinate
    * @param {Number} y - point y coordinate
    * @return {Object} - new HSV color values (some channels may be missing)
  */
  input(x, y) {
    var opts = this._opts,
        rangeMax = opts.rMax;

    x = opts.r - x;
    y = opts.r - y;

    var angle = Math.atan2(y, x),
        // Calculate the hue by converting the angle to radians
        hue = round(angle * (180 / PI)) + 180,
        // Find the point's distance from the center of the wheel
        // This is used to show the saturation level
        dist = Math.min(sqrt(x * x + y * y), rangeMax);
    
    hue = (opts.anticlockwise ? 360 - hue : hue);

    // Return just the H and S channels, the wheel element doesn't do anything with the L channel
    return {
      h: hue,
      s: round((100 / rangeMax) * dist)
    };
  }
}