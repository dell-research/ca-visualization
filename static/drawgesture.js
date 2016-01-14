var MAX_WIDTH = 15;
var HALF_WIDTH = MAX_WIDTH / 2;

// Has to match canvas#gesture width and height in style.css
var CANVAS_X = 333;
var CANVAS_Y = 533;
var screenX = -1;
var screenY = -1;

var pathList = [];
var pathExpire = [];

this.readscreeninfo = function(screeninfo) {
	// Store the screen size to fit the gestures in the canvas
	screenX = screeninfo.x;
	screenY = screeninfo.y;
}

this.drawgesture = function(gesture) {
	project.clear();
	pathList = [];
	pathExpire = [];
	
	// Find the minimum and maximum observed pressure for later normalization
	var minPres = 10000;
	var maxPres = 0;
	var maxPoint;
	for(var n = 0; n< gesture.points.length; n++) {
		var point = gesture.points[n];
		
		if(point.pres > maxPres) {
			maxPres = point.pres;
			maxPoint = point;
		} else if(point.pres < minPres) {
			minPres = point.pres;
		}
	}
	var delta = maxPres - minPres;

	// Draw the gesture
	var currentTime = new Date().getTime();
	var lastPoint;	
	for(var n = 0; n < gesture.points.length; n++) {
		var currentPoint = gesture.points[n];
		var tfirst;
		
		if(lastPoint) {
			var x0 = lastPoint.x;
			var y0 = lastPoint.y;
			var pres0 = lastPoint.pres;
			
			var t1 = currentPoint.time;
			var x1 = currentPoint.x;
			var y1 = currentPoint.y;
			var pres1 = currentPoint.pres;
			
			// Fit the points onto the canvas
			if(screenX > 0 && screenY > 0) {
				x0 = (x0 / screenX) * CANVAS_X;
				y0 = (y0 / screenY) * CANVAS_Y;
				
				x1 = (x1 / screenX) * CANVAS_X;
				y1 = (y1 / screenY) * CANVAS_Y;
			}
			
			// Set the segment's width and color based on the normalized average pressure between the two endpoints 
			var avgPres = (pres0 + pres1) / 2;
			
			var width = -1;			
			if(delta > 0) {
				width = Math.max(((avgPres - minPres) / delta) * MAX_WIDTH, 1);
			} else {
				width = 1;
			}
			
			var red = 1;
			var green = 1;
			var blue = 0;
			var distanceFromMidWidth = Math.abs(width - HALF_WIDTH);
			if(width > HALF_WIDTH) {
				// Less green for heavy touches
				green = 1 - (distanceFromMidWidth / HALF_WIDTH);
			} else {
				// Less red for light touches
				red = 1 - (distanceFromMidWidth / HALF_WIDTH);
			}
			
			// Generate new line segment, add an endcap to the last segment
			var path = new Path();
			path.strokeColor = new Color(red, green, blue);
			path.strokeWidth = width;
			path.add(new Point(x0, y0), new Point(x1, y1));
			
			// Add to the path list for future fades
			pathList.push(path);
			
			var expireWeight = (n / gesture.points.length);
			expireWeight = expireWeight * expireWeight * 7;
			pathExpire.push(currentTime + ((t1 - tfirst) * expireWeight * 1000));
		} else {
			tfirst = currentPoint.time;
		}
		
		lastPoint = currentPoint;
	}
	
	view.draw();
}

function onFrame(event) {
	// Fade out any paths on screen
	var clearPath = false;
	var currentTime = new Date().getTime();
	
	for(var n = 0; n < pathList.length && pathExpire.length; n++) {
		var path = pathList[n];
		var expire = pathExpire[n];
		
		if(path.opacity > 0 && currentTime > expire) {
			path.opacity = path.opacity - 0.025;
		} 
		
		if(path.opacity <= 0) {
			path.removeSegments();
		}
	}
}

paper.install(window.paperscript);