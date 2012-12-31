/*global Quintus:false */

Quintus.Sprites = function(Q) {
 
  // Create a new sprite sheet
  // Options:
  //  tilew - tile width
  //  tileh - tile height
  //  w     - width of the sprite block
  //  h     - height of the sprite block
  //  sx    - start x
  //  sy    - start y
  //  cols  - number of columns per row
  Q.Class.extend("SpriteSheet",{
    init: function(name, asset,options) {
      if(!Q.asset(asset)) { throw "Invalid Asset:" + asset; }
      Q._extend(this,{
        name: name,
        asset: asset,
        w: Q.asset(asset).width,
        h: Q.asset(asset).height,
        tilew: 64,
        tileh: 64,
        sx: 0,
        sy: 0
        });
      if(options) { Q._extend(this,options); }
      this.cols = this.cols || 
                  Math.floor(this.w / this.tilew);
    },

    fx: function(frame) {
      return Math.floor((frame % this.cols) * this.tilew + this.sx);
    },

    fy: function(frame) {
      return Math.floor(Math.floor(frame / this.cols) * this.tileh + this.sy);
    },

    draw: function(ctx, x, y, frame) {
      if(!ctx) { ctx = Q.ctx; }
      ctx.drawImage(Q.asset(this.asset),
                    this.fx(frame),this.fy(frame),
                    this.tilew, this.tileh,
                    Math.floor(x),Math.floor(y),
                    this.tilew, this.tileh);

    }

  });


  Q.sheets = {};
  Q.sheet = function(name,asset,options) {
    if(asset) {
      Q.sheets[name] = new Q.SpriteSheet(name,asset,options);
    } else {
      return Q.sheets[name];
    }
  };

  Q.compileSheets = function(imageAsset,spriteDataAsset) {
    var data = Q.asset(spriteDataAsset);
    Q._each(data,function(spriteData,name) {
      Q.sheet(name,imageAsset,spriteData);
    });
  };


  Q.SPRITE_DEFAULT  = 1;
  Q.SPRITE_PARTICLE = 2;
  Q.SPRITE_ACTIVE   = 4;
  Q.SPRITE_FRIENDLY = 8;
  Q.SPRITE_ENEMY    = 16;
  Q.SPRITE_UI       = 32;


  
// Properties:
  //    x
  //    y
  //    z - sort order
  //    sheet or asset
  //    frame
  Q.GameObject.extend("Sprite",{
    init: function(props,defaultProps) {
      this.p = Q._extend({ 
        x: 0,
        y: 0,
        z: 0,
        angle: 0,
        frame: 0,
        type: Q.SPRITE_DEFAULT | Q.SPRITE_ACTIVE
      },defaultProps);

      this.matrix = new Q.Matrix2D();

      Q._extend(this.p,props); 

      if((!this.p.w || !this.p.h)) {
        if(this.asset()) {
          this.p.w = this.p.w || this.asset().width;
          this.p.h = this.p.h || this.asset().height;
        } else if(this.sheet()) {
          this.p.w = this.p.w || this.sheet().tilew;
          this.p.h = this.p.h || this.sheet().tileh;
        }
      }
      this.p.cx = this.p.cx == void 0 ? (this.p.w / 2) : this.p.cx;
      this.p.cy = this.p.cy == void 0 ? (this.p.h / 2) : this.p.cy;
      this.p.id = this.p.id || Q._uniqueId();

      this.c = { points: [] };

      this.refreshMatrix();
    },

    asset: function() {
      return Q.asset(this.p.asset);
    },

    sheet: function() {
      return Q.sheet(this.p.sheet);
    },

    hide: function() {
      this.p.hidden = true;
    },

    show: function() {
      this.p.hidden = false;
    },

    set: function(properties) {
      Q._extend(this.p,properties);
      return this;
    },

    render: function(ctx) {
      var p = this.p;

      if(p.hidden) { return; }
      if(!ctx) { ctx = Q.ctx; }

      this.trigger('predraw',ctx);

      ctx.save();

        if(this.p.opacity != void 0 && this.p.opacity != 1) {
          ctx.globalAlpha = this.p.opacity;
        }

        this.matrix.setContextTransform(ctx);

        this.trigger('beforedraw',ctx);
        this.draw(ctx);
        this.trigger('draw',ctx);

      ctx.restore();
      
      // Children set up their own complete matrix
      // from the base stage matrix
      Q._invoke(this.children,"render",ctx);
      
      this.trigger('postdraw',ctx);

      if(Q.debug) { this.debugRender(ctx); }

    },

    draw: function(ctx) {
      var p = this.p;
      if(p.sheet) {
        this.sheet().draw(ctx,-p.cx,-p.cy,p.frame);
      } else if(p.asset) {
        ctx.drawImage(Q.asset(p.asset),-p.cx,-p.cy);
      }
    },

    debugRender: function(ctx) {
      if(this.p.points) {
        ctx.save();
        this.matrix.setContextTransform(ctx);
        ctx.beginPath();
        ctx.fillStyle = this.p.hit ? "blue" : "red";
        ctx.strokeStyle = "#FF0000";
        ctx.fillStyle = "rgba(0,0,0,0.5)";

        ctx.moveTo(this.p.points[0][0],this.p.points[0][1]);
        for(var i=0;i<this.p.points.length;i++) {
          ctx.lineTo(this.p.points[i][0],this.p.points[i][1]);
        }
        ctx.lineTo(this.p.points[0][0],this.p.points[0][1]);
        ctx.stroke();
        if(Q.debugFill) { ctx.fill(); }

        ctx.restore();

        if(this.c) { 
          var c = this.c;
          ctx.save();
            ctx.globalAlpha = 1;
            ctx.lineWidth = 2;
            ctx.strokeStyle = "#FF00FF";
            ctx.beginPath();
            ctx.moveTo(c.x - c.cx,       c.y - c.cy);
            ctx.lineTo(c.x - c.cx + c.w, c.y - c.cy);
            ctx.lineTo(c.x - c.cx + c.w, c.y - c.cy + c.h);
            ctx.lineTo(c.x - c.cx      , c.y - c.cy + c.h);
            ctx.lineTo(c.x - c.cx,       c.y - c.cy);
            ctx.stroke();
          ctx.restore();
        }
      }
    },

    step: function(dt) {
      this.trigger('prestep',dt);
      this.trigger('step',dt);
      this.refreshMatrix();
      Q._invoke(this.children,"step",dt);
    },

    refreshMatrix: function() {
      var p = this.p;
      this.matrix.identity();

      if(this.container) { this.matrix.multiply(this.container.matrix); }
      
      this.matrix.translate(p.x,p.y)

      if(p.scale) { this.matrix.scale(p.scale,p.scale); }

      this.matrix.rotateDeg(p.angle)
    }
  });

  Q.Sprite.extend("MovingSprite",{
    init: function(props,defaultProps) {
      this._super(Q._extend({
        vx: 0,
        vy: 0,
        ax: 0,
        ay: 0
      },props),defaultProps);
   },

   step: function(dt) {
     var p = this.p;

     p.vx += p.ax * dt;
     p.vy += p.ay * dt;

     p.x += p.vx * dt;
     p.y += p.vy * dt;

     this._super(dt);
   }
 });




  return Q;
};
