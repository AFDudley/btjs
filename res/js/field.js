var Field = {

    stage: undefined,
    scale: 25,
    tileLayer: new Kinetic.Layer(),
    tiles: [],
    indicatorLayer: new Kinetic.Layer(),
    indicator: undefined,
    changed: {}, //takes an index as a key and color as a value
    attackable: null,
    movable: null,

    setSize: function(width, height) {
        Field.stage.setSize(width, height);
        Field.update();
    },

    init: function() {
        Field.stage = new Kinetic.Stage({
            container: "field",
            width: 768,
            height: 768
        });

        Field.indicator = new Kinetic.RegularPolygon({
            name: "indicator",
            x: 0,
            y: 0,
            sides: 6,
            radius: Field.scale,
            fill: 'rgba(255,255,255,0.25)',
            stroke: 'rgba(255,255,255,0.25)',
            strokeWidth: 1
        });

        Field.indicator.on("mousedown", function() {
            Field.indicator.setFill('rgba(0,0,0,0.25)');
            Field.indicator.show();
            Field.indicatorLayer.draw();
        });

        Field.indicator.on("mouseup", function() {
            Field.indicator.setFill('rgba(255,255,255,0.5)');
            Field.indicator.show();
            Field.indicatorLayer.draw();
        });

        Field.indicator.on("click", function() {
            if (Field.indicator.tileIndex) {
                Field.onTileClick.apply(Field, [ Field.indicator.tileIndex ]);
            }
        });

        Field.indicator.on("mouseout", function() {
            Field.hideIndicator();
        });

        Field.indicatorLayer.add(Field.indicator);

        Field.stage.add(Field.tileLayer);
        Field.stage.add(Field.indicatorLayer);
    },

    clear: function() {
        Field.tileLayer.removeChildren();
    },

    update: function() {
        /*
        Tile changes should be placed into a "queue" and applied at once on
        Field.update(). Which then reads the list of tiles and updates them.
        and does not check every tile.
        */
        Field.clear(); 
        var tiles = Field.tiles;

        for (var i = 0; i < 16; i++) {
            tiles[i] = [];
            for (var j = 0; j < 16; j++) {
                var tile = new Field.FieldTile([i, j]);
                var tileSet = new JS.Set([ tile.index ]);
                tiles[i][j] = tile;
                Field.tileLayer.add(tiles[i][j].shapes);
                
                // first just make sure every tile is gray
                tile.setForegroundColor(colors.dark_gray);
                tile.setBackgroundColor(colors.gray);
                
                if (GameState.battlefield) {
                    var unit = GameState.battlefield.getUnitByLocation([i, j]);
                    // do we have a unit?
                    if (unit) {
                        
                        // are we the owner?
                        if (unit.owner === GameState.player) {
                            
                            // check to see if it is the selected unit
                            if (unit === ui.selectedUnit) {
                                
                                // color it light red
                                tile.setForegroundColor(colors.dark_red);
                                tile.setBackgroundColor(colors.dark_red);
                            } else {
                                
                                // color it red
                                tile.setForegroundColor(colors.red);
                                tile.setBackgroundColor(colors.red);
                            }
                        } else {
                            
                            // color it blue
                            tile.setForegroundColor(colors.blue);
                            tile.setBackgroundColor(colors.blue);
                        }
                    }
                }
                
                // colorize, but not the selected unit
                if (unit !== ui.selectedUnit) {
                    if (this.weaponRange && this.weaponRange.intersection(tileSet).entries().length > 0) {
                        if (unit) {
                            tile.setForegroundColor(colors.trans_green);
                        } else {
                            tile.setForegroundColor(colors.green);
                            tile.setBackgroundColor(colors.dark_green);
                        }
                    } else if (this.movable && this.movable.intersection(tileSet).entries().length > 0) {
                        tile.setForegroundColor(colors.yellow);
                        tile.setBackgroundColor(colors.dark_yellow);
                    }
                }
            }
        }
        
        Field.stage.draw();
    },

    FieldTile: function(index) {
        var trig = {
            a: Math.sqrt(3) / 2,
            b: 1 / 2,
            c: 1
        };
        var width = 33 * trig.a;
        var height = (17 * trig.b) + 16;
        var i = index[0];
        var j = index[1];
        var x = (i * (2 * trig.a)) + ((j % 2) * trig.a);
        var y = (j * (3 * trig.b));
        var position = [(x + (1 - width / 2)), (y + (1 - height / 2))];
        x = position[0] * Field.scale + (Field.stage.getWidth() / 2);
        y = position[1] * Field.scale + (Field.stage.getHeight() / 2);
        
        // if (GameState.battlefield) {
        //     this.tile = GameState.battlefield.grid.tile[x][y];
        // }
        
        this.index = index;
        this.position = [x, y];
        this.shapes = new Kinetic.Group();
        this.shapes.add(new Field.CustomHex('background', x, y, 1.0 * Field.scale, 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.15)', 2, 'lighter'));
        this.shapes.add(new Field.CustomHex('foreground', x, y, 0.8 * Field.scale, 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.15)', 1, 'lighter'));

        this.shapes.on("mouseover", function() {
            Field.showIndicator(index, x, y);
            if (Field.onTileOver) {
                Field.onTileOver.apply(this, [index]);
            }
        });
        //Color should be additive.
        this.setColor = function(layer, color) {
            this.shapes.get(layer)[0].setFill(color)
        }
        
        this.setForegroundColor = function(color) {
            this.setColor(".foreground", color)
        }
        
        this.setBackgroundColor = function(color) {
            this.setColor(".background", color)
        }
    },

    CustomHex: function(name, x, y, radius, fill, stroke, strokeWidth, composite) {
        return new Kinetic.Shape({
            name: name,
            x: x,
            y: y,
            sides: 6,
            radius: radius,
            fill: fill,
            stroke: stroke,
            strokeWidth: strokeWidth,
            drawFunc: function(context) {
                context.globalCompositeOperation = composite;
                context.beginPath();
                context.moveTo(0, 0 - this.attrs.radius);

                for (var n = 1; n < this.attrs.sides; n++) {
                    var x = this.attrs.radius * Math.sin(n * 2 * Math.PI / this.attrs.sides);
                    var y = -1 * this.attrs.radius * Math.cos(n * 2 * Math.PI / this.attrs.sides);
                    context.lineTo(x, y);
                }
                context.closePath();
                this.fill(context);
                this.stroke(context);
            }
        });
    },

    showIndicator: function(index, x, y) {
        Field.indicator.tileIndex = index;
        Field.indicator.setPosition(x, y);
        Field.indicator.setFill('rgba(255,255,255,0.25)');
        Field.indicator.show();
        Field.indicatorLayer.draw();
        //console.log("Show Tile Indicator: %d %d", x , y);
    },

    hideIndicator: function() {
        Field.indicator.tileIndex = undefined;
        Field.indicator.hide();
        Field.indicatorLayer.draw();
        //console.log("Hide Tile Indicator");
    },
    
    onTileClick: function(index) {
        // did we click on tile holding a unit?
        var unit = GameState.battlefield.getUnitByLocation(index);
        if (unit) {
            
            // has one of our units already been selected?
            if (ui.selectedUnit) {
                
                // if we clicked the selected unit again, just deselect it
                if (unit === ui.selectedUnit) {
                    ui.selectedUnit = null;
                    this.weaponRange = null;
                    this.attackable = null;
                    this.movable = null;
                    ui.setLeftUnit();
                } else {
                    
                    // attack! even if it's our unit!
                    ui.showConfirm({
                        header: "Action",
                        message: "Attack unit?",
                        onconfirm: function() {
                            GameState.sendActionAndProcessResult(ui.selectedUnit.ID, "attack", index);
                            Field.computeRanges(index);
                        }
                    });
                }
                
            // if no unit is selected, check to see
            // if we own the one we just clicked on
            // TODO: would be nice if getUnitOwnerByLocation was a property 'owner' on unit...
            } else if (GameState.battlefield.getUnitByLocation(index).owner === GameState.player) {
                ui.selectedUnit = unit
                ui.setLeftUnit(unit);
                Field.computeRanges(index);
            } else {
                alert("That's not your unit");
            }
          
        // if we didn't click on another unit, but 
        // have a selection, then we are trying to move
        } else if (ui.selectedUnit) {
            ui.showConfirm({
                header: "Action",
                message: "Move unit?",
                onconfirm: function() {
                    GameState.sendActionAndProcessResult(ui.selectedUnit.ID, "move", index);
                    Field.computeRanges(index);
                }
            });
        }
        Field.update()
    },
    
    computeRanges: function(index) {
        if (index) {
            var moveRange = GameState.battlefield.makeRange(index, ui.selectedUnit.move);
            var occupied = new JS.Set(_.values(GameState.battlefield.locs));
            //BUGGY:wands don't have a range.
            this.weaponRange = GameState.battlefield.tilesInRangeOfWeapon(index, ui.selectedUnit.weapon);
            this.attackable = this.weaponRange.intersection(occupied);
            this.movable = moveRange.difference(occupied);
        } else { //HACK fix later.
            ui.selectedunit = null;
            this.attackable = null;
            this.moveable = null;
        }
        this.update();
    },
    
    onTileOver: function(index) {
        
        // HACK before the battlefield is created from the server info we shouldn't do this
        if (!GameState.battlefield) return;
        
        var unit = GameState.battlefield.getUnitByLocation(index);
        if (unit) { //If unit is at location
            //Check Owner
            if (GameState.owners[unit.ID] != GameState.player) {
                ui.setRightUnit(unit);
                //Context Menus Will Go Here
            } else {
                ui.setRightUnit();
                //ui.setRightUnit(GameState.battlefield.units[unit.ID]);
                //Context Menus Will Go Here
            }
        } else {
            ui.setRightUnit();
        }
    }
    
    // Field.onTileOver = function(index, position){
    //  ui.showTileIndicator(position[0], position[1]);
    // }
}
