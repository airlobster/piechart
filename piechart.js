
function cloneObject(o) {
	return o ? jQuery.extend(true, {}, o) : {};
}

/**
	*********************************************************************************
	SEEDED RANDOM GENERATOR
	*********************************************************************************
**/
function Random(seed) {
	this.seed = seed;
	this.rand = function(min, max) {
		max = max || 1;
		min = min || 0;
		this.seed = (this.seed * 9301 + 49297) % 233280;
		var rnd = this.seed / 233280;
		return min + rnd * (max - min);
	}
}

/**
	*********************************************************************************
	HSL
	*********************************************************************************
**/
var HSL = function(h,s,l) {
	this.h = h || 0;
	this.s = s || 0;
	this.l = l || 0;
}
HSL.prototype.h = -1;
HSL.prototype.s = -1;
HSL.prototype.l = -1;
HSL.prototype.toString = function()  {
	return "hsl("+this.h+","+this.s+"%,"+this.l+"%)";
}


/**
	*********************************************************************************
	RANDOM HSL COLORS GENERATOR
	*********************************************************************************
**/
function RandomHSL(opt) {
	this.options = cloneObject(opt);
	this.random = new Random(this.options.seed || 1);
	this.next = function() {
		var hsl = new HSL(
			Math.round(this.random.rand(this.options.h.min, this.options.h.max)),
			Math.round(this.random.rand(this.options.s.min, this.options.s.max)),
			Math.round(this.random.rand(this.options.l.min, this.options.l.max))
		);
		return hsl;
	};
	this.setOptions = function(opt) {
		this.options = opt ? cloneObject(opt) : {};
		this.optionsFixup();
	}
	this.optionsFixup = function() {
		if( ! this.options )
			this.options = {};
		if( ! this.options.h )
			this.options.h = {};
		this.options.h.min = this.options.h.min || 0;
		this.options.h.max = this.options.h.max || 360;
		if( ! this.options.s )
			this.options.s = {};
		this.options.s.min = this.options.s.min || 10;
		this.options.s.max = this.options.s.max || 70;
		if( ! this.options.l )
			this.options.l = {};
		this.options.l.min = this.options.l.min || 50;
		this.options.l.max = this.options.l.max || 50;
	}
	this.optionsFixup();
}

/**
	*********************************************************************************
	EXTEND HTMLCanvasElement
	*********************************************************************************
**/
HTMLCanvasElement.prototype.extendMouseEvents = function() {
	this.mapMouseEvent = function(ev) {
		var r = this.getBoundingClientRect();
		ev.canvasX = Math.round(ev.pageX - r.left);
		ev.canvasY = Math.round(ev.pageY - r.top);
	};
	this.addEventListener("mousemove", this.mapMouseEvent);
	this.addEventListener("click", this.mapMouseEvent);
	this.addEventListener("contextmenu", this.mapMouseEvent);
	this.addEventListener("dblclick", this.mapMouseEvent);
	this.addEventListener("mousedown", this.mapMouseEvent);
	this.addEventListener("mouseenter", this.mapMouseEvent);
	this.addEventListener("mouseleave", this.mapMouseEvent);
	this.addEventListener("mouseover", this.mapMouseEvent);
	this.addEventListener("mouseout", this.mapMouseEvent);
	this.addEventListener("mouseup", this.mapMouseEvent);
}

/**
	*********************************************************************************
	PIE-CHART
	*********************************************************************************
**/
function PieChart(id, opt) {
	this.options = cloneObject(opt); // enforce deep copy
	this.container = document.getElementById(id);
	if( ! this.container ) {
		throw "No such element!";
	}
	$(this.container).addClass("adi-piechart-container");
	$(this.container).html("<canvas class=\"chart\"></canvas><div class=\"legend\"></div>");
	this.canvas = $(this.container).find("canvas")[0];
	this.ctx = this.canvas.getContext("2d");
	this.canvas.extendMouseEvents();
	this.legend = $(this.container).find(".legend")[0];
	this.raw_data = [];
	this.graph = null;
	this.total = 0;
	this.randomColor = new RandomHSL(this.options.hsl);
	this.prevContainerSize = {};
	this.selectedSlice = 0;
	this.chartMeasures = {};

	var self = this;

	this.setOptions = function(options) {
		this.options = cloneObject(options);
		this.optionsFixup();
		this.randomColor.setOptions(this.options);
		this.redraw();
	};
	this.setData = function(data) {
		this.raw_data = data ? data : [];
		// calc total
		this.total = 0;
		for(var sliceIndex in this.raw_data) {
			var sliceData = this.raw_data[sliceIndex];
			this.total += sliceData.value;
		}
		// complete slice colors list if more colors are needed
		this.seed = this.seedAnchor;
		for(var i=this.options.colors.length; i < this.raw_data.length; i++) {
			while( true ) {
				var c = this.getRandomColor();
				if( this.options.colors.indexOf(c) != -1 )
					continue; // color already used. try again.
				this.options.colors.push(c);
				break;
			}
		}
		this.calculateGraph();
		this.updateLegend();
	};
	this.getSliceInfo = function(index) {
		if( index < 1 || index > this.raw_data.length )
			return null;
		var o = cloneObject(this.raw_data[index-1]);
		o.index = index;
		o.relative = Math.round(100 * o.value / this.total) + "%";
		o.color = this.graph[index-1].fill;
		return o;
	}
	this.getSelectedSliceInfo = function() {
		if( this.selectedSlice == 0 )
			return null;
		return this.getSliceInfo(this.selectedSlice);
	}
	this.updateLegend = function() {
		var i, slice;
		// remove previous legend elements
		$(this.legend).html("<ul></ul>");
		// create legend list
		for(i in this.graph) {
			slice = this.graph[i];
			$(this.legend).find("ul").append("<li data-slice=\""+(parseInt(i)+1)+"\"><span></span><span>"+slice.label.name+"</span></li>");
		}
		// assign legend colors
		for(i in this.graph) {
			slice = this.graph[i];
			var sel = "li:nth-child("+(parseInt(i)+1)+") span:nth-child(1)";
			$(this.legend).find(sel).css("background-color", slice.fill);
		}
		// event handlers
		if( this.options.interactive ) {
			$(this.legend).find("li>span").on("mouseenter", function(ev){
				var index = parseInt($(ev.target).closest("li").attr("data-slice"));
				self.selectSlice(index);
				self.redraw();
			});
			$(this.legend).find("li>span").on("mouseout", function(ev){
				self.selectSlice(0);
				self.redraw();
			});
			$(this.legend).find("li>span").on("click", function(ev){
				self.notifySliceClicked();
			});
			$(this.legend).find("li>span").on("dblclick", function(ev){
				self.notifySliceDblClicked();
			});
		}
	};
	this.redraw = function(callback) {
		var nDrawn = 0;
		var m = this.chartMeasures;
		this.ctx.clearRect(0, 0, m.w, m.h);
		if( this.raw_data.length != 0 ) {
			var sliceIndex;
			var g;
			// slices
			for(sliceIndex in this.graph) {
				if( this.raw_data[sliceIndex].value < 1 )
					continue; // skip empty slices
				g = this.graph[sliceIndex];
				this.drawSlice(g);
				nDrawn++;
			}
			// labels
			for(sliceIndex in this.graph) {
				if( this.raw_data[sliceIndex].value < 1 )
					continue; // skip empty slices
				g = this.graph[sliceIndex];
				this.drawSliceLabel(g);
			}
		}
		if( nDrawn == 0 )
			this.drawEmptyPie();
		if( callback )
			callback();
	};
	this.calculateGraph = function() {
		var graph = [];
		var startAngle = 3 * 2 * Math.PI / 4; // north
		var doughnutRadius = this.options.doughnut * this.chartMeasures.r;
		var labelOffset = doughnutRadius + (this.chartMeasures.r - doughnutRadius) * 0.5;
		for(var sliceIndex in this.raw_data) {
			var sliceData = this.raw_data[sliceIndex];
			if( sliceData / this.total < 1 )
				continue;
			var sliceAngle = 2 * Math.PI * sliceData.value / this.total;
			graph.push({
				index: parseInt(sliceIndex)+1,
				from: startAngle,
				to: startAngle+sliceAngle,
				fill: this.options.colors[parseInt(sliceIndex)],
				selected: false,
				label: {
					x: (this.chartMeasures.w / 2) + labelOffset * Math.cos(startAngle + sliceAngle / 2),
					y: (this.chartMeasures.h / 2) + labelOffset * Math.sin(startAngle + sliceAngle / 2),
					value: Math.round(100 * sliceData.value / this.total),
					name: sliceData.name
				}
			});
			startAngle += sliceAngle;
		}
		this.graph = graph;
	};
	this.markSelectedSliceByMousePosition = function(x, y) {
		var i = 0;
		for(var sliceIndex in this.graph) {
			var g = this.graph[sliceIndex];
			if( this.isMouseInSlice(x, y, g) )
				i = parseInt(sliceIndex) + 1;
		}
		self.selectSlice(i);
	};
	this.drawSlice = function(g) {
		var m = this.chartMeasures;
		this.ctx.font = this.options.text.font;
		this.ctx.textAlign = "center";
		this.ctx.fillStyle = g.fill;
		this.ctx.strokeStyle = this.options.stroke.color;
		this.drawArc(m.x, m.y, m.r, g.from, g.to, g.selected);
		this.ctx.fill();
		if( this.options.stroke.color )
			this.ctx.stroke();
	};
	this.drawSliceLabel = function(g) {
		this.ctx.fillStyle = this.options.text.color;
		this.ctx.fillText(g.label.value+'%', g.label.x, g.label.y);
	};
	this.isMouseInSlice = function(x, y, g) {
		var m = this.chartMeasures;
		this.drawArc(m.x, m.y, m.r, g.from, g.to, false);
		return this.ctx.isPointInPath(x, y);
	};
	this.drawEmptyPie = function() {
		var m = this.chartMeasures;
		this.ctx.fillStyle = this.options.defaultColor;
		this.drawArc(m.x, m.y, m.r, 0, 2 * Math.PI);
		this.ctx.fill();
		this.ctx.font = "italic "+this.options.font;
		this.ctx.textAlign = "center";
		this.ctx.fillStyle = "darkred";
		this.ctx.fillText("No data", m.x, m.y);
	};
	this.drawArc = function(x, y, r, startAngle, endAngle, selected) {
		this.ctx.beginPath();
		this.ctx.arc(x, y, r + (selected ? this.options.selectionOffset : 0), startAngle, endAngle);
		this.ctx.arc(x, y, r * this.options.doughnut, endAngle, startAngle, true);
		this.ctx.closePath();
	};
	this.recalcMeasures = function() {
		var canvasRatio = 0.7;
		var margin = 0;
		var canvasMin;
		var canvas = {};
		var legend = {};
		switch( this.options.legendPos ) {
			case "top": {
				legend = {top: margin, right: margin, height: 100*(1-canvasRatio)+"%", left: margin};
				canvas = {/*height: 100*canvasRatio+"%",*/ right: 0, bottom: 0, left: 0};
				canvasMin = Math.floor(Math.min(this.container.clientWidth, this.container.clientHeight * canvasRatio));
				break;
			}
			case "right": {
				legend = {top: margin, right: margin, bottom: margin, width: Math.round((100*(1-canvasRatio)))+"%"};
				canvas = {top: margin, /*width: (100*canvasRatio)+"%",*/ bottom: margin, left: margin};
				canvasMin = Math.floor(Math.min(this.container.clientWidth * canvasRatio, this.container.clientHeight));
				break;
			}
			case "bottom": {
				legend = {right: margin, height: 100*(1-canvasRatio)+"%", left: margin, bottom: margin};
				canvas = {/*height: 100*canvasRatio+"%",*/ right: margin, left: margin, top: margin};
				canvasMin = Math.floor(Math.min(this.container.clientWidth, this.container.clientHeight * canvasRatio));
				break;
			}
			case "left": {
				legend = {top: margin, left: margin, bottom: margin, width: 100*(1-canvasRatio)+"%"};
				canvas = {top: margin, /*width: 100*canvasRatio+"%",*/ bottom: margin, right: margin};
				canvasMin = Math.floor(Math.min(this.container.clientWidth * canvasRatio, this.container.clientHeight));
				break;
			}
		}
		canvasMin -= 20;
		this.canvas.width = this.canvas.height = canvasMin;
		this.ctx.width = this.ctx.height = canvasMin;
		$(this.legend).css(legend);
		$(this.canvas).css(canvas);
		this.prevContainerSize = {w:this.container.clientWidth, h:this.container.clientHeight};

		var m = {};
		m.w = this.ctx.width;
		m.h = this.ctx.height;
		m.x = m.w / 2;
		m.y = m.h / 2;
		m.r = Math.min(m.x, m.y) - this.options.selectionOffset - 1;
		this.chartMeasures = m;
	};
	this.selectSlice = function(sliceIndex) {
		if( this.selectedSlice != sliceIndex ) {
			// notify out...
			$(this.legend).find("li.selected").removeClass("selected");
			if( this.selectedSlice != 0 ) {
				this.graph[this.selectedSlice-1].selected = false;
				this.notifySliceOut();
				$(this.container).css("cursor", "default");
			}
			// change
			this.selectedSlice = sliceIndex;
			// notify in...
			var sel = "li[data-slice="+(this.selectedSlice)+"]";
			$(this.legend).find(sel).addClass("selected");
			if( this.selectedSlice != 0 ) {
				this.graph[this.selectedSlice-1].selected = true;
				this.notifySliceIn();
				$(this.container).css("cursor", "pointer");
			}
		}
	};
	this.getRandomColor = function() {
		return this.randomColor.next().toString();
	};
	this.resize = function() {
		// compare to previously known measures. if anything changed - redraw.
		var currContainerSize = {w:this.container.clientWidth, h:this.container.clientHeight};
		if( currContainerSize.w != this.prevContainerSize.w || currContainerSize.h != this.prevContainerSize.h ) {
			this.recalcMeasures();
			this.calculateGraph();
			this.redraw();
		}
	};
	this.notifySliceClicked = function() {
		this.container.dispatchEvent(this.createSliceEvent("sliceclick"));
	}
	this.notifySliceDblClicked = function() {
		this.container.dispatchEvent(this.createSliceEvent("slicedblclick"));
	}
	this.notifySliceIn = function() {
		this.container.dispatchEvent(this.createSliceEvent("slicein"));
	}
	this.notifySliceOut = function() {
		this.container.dispatchEvent(this.createSliceEvent("sliceout"));
	}
	this.createSliceEvent = function(name) {
		return new CustomEvent(name, {detail:{slice:this.getSelectedSliceInfo()},bubbles:true});
	}
	this.optionsFixup = function() {
		// doughnut
		this.options.doughnut = this.options.doughnut ? Math.min(this.options.doughnut,0.9) : 0;
		// selection radius diff
		this.options.selectionOffset = this.options.selectionOffset || 6;
		// text
		if( ! this.options.text )
			this.options.text = {};
		if( ! this.options.text.font )
			this.options.text.font = '11px Arial';
		if( ! this.options.text.color )
			this.options.text.color = 'black';
		// colors
		if( ! this.options.colors )
			this.options.colors = [];
		if( ! this.options.defaultColor )
			this.options.defaultColor = "#ddd";
		// stroke
		if( ! this.options.stroke )
			this.options.stroke = {};
		// legend position
		if( ! this.options.legendPos || ["top", "right", "bottom", "left"].indexOf(this.options.legendPos) == -1 )
			this.options.legendPos = 'right';
	}

	// options fixup
	this.optionsFixup();
	// styling
	$(this.container).css("position", "relative").css("overflow", "hidden");
	$(this.legend).css("position", "absolute").css("font", this.options.font);
	$(this.canvas).css("position", "absolute");
	// bind this object to the container element
	this.container.piechart = this;
	// periodic resize check
	setInterval(function(me){
		me.resize();
	}, 300, this);
	// mouse tracking.
	if( this.options.interactive ) {
		$(this.canvas).on("mousemove", function(ev){
			self.markSelectedSliceByMousePosition(ev.originalEvent.canvasX, ev.originalEvent.canvasY);
			self.redraw();
		});
		$(this.canvas).on("mouseout", function(ev){
			self.markSelectedSliceByMousePosition(-1, -1);
			self.redraw();
		});
		$(this.canvas).on("click", function(ev){
			if( self.selectedSlice != 0 ) {
				self.notifySliceClicked();
			}
		});
		$(this.canvas).on("dblclick", function(ev){
			if( self.selectedSlice != 0 ) {
				self.notifySliceDblClicked();
			}
		});
	}
	this.recalcMeasures();
}
