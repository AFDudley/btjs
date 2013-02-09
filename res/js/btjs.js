var _intervalUpdateState;
var GameState = {
    grid: undefined,
    locs: undefined,
    owners: undefined,
    start_time: undefined,
    time_left: undefined,
    units: undefined,
    whose_action: undefined,
    player: "",
    action_count: 1,
    ply_no: 1,
    turn_no: 1,
    battlefield: undefined,
    last_result: { num: 0 },
    last_last_result: { num: 0 },

    //This init function is bad, it should check the current state AND initial_state.
    init: function(cb) {
        // get username
        var getUsername = battleService.get_username();
        getUsername.then(function(username) {
            GameState.player = username;
            
            // get initial state
            var getInitialState = battleService.initial_state();
            getInitialState.then(function(res) {
                var state = res.initial_state;
                GameState.grid = state.grid.grid;
                GameState.locs = state.init_locs;
                GameState.owners = state.owners;
                GameState.start_time = state.start_time;
                GameState.units = state.units;
                GameState.player_names = state.player_names;
                GameState.whose_action = GameState.player_names[0];
                
                for (var ID in GameState.units) {
                  
                    // make 'grid' and 'units' scients homologous and attach their ID's
                    var scient = GameState.units[ID].scient;
                    scient.ID = ID;
                    scient.owner = GameState.owners[ID];
                    var x = scient.location[0];
                    var y = scient.location[1];
                    GameState.grid.tiles[x][y].tile.contents.scient = scient;
                }
                
                // create the battlefield
                GameState.battlefield = new Battlefield(GameState.grid, GameState.locs, GameState.owners);
                cb();
            });
        });
    },
    
    update: function() {
        var response = battleService.last_result();
        response.then(GameState.processActionResult);
        
        var get_timeLeft = battleService.time_left();
        get_timeLeft.then(function(result) {
            var a = result.battle.split(':'); // split it at the colons
            var seconds = (+a[0]) * 60 * 60 + (+a[1]) * 60 + (+a[2]);
            var t = new Date(1970, 0, 1);
            t.setSeconds(seconds);
            GameState.time_left_battle = t;

            var a = result.ply.split(':'); // split it at the colons
            var seconds = (+a[0]) * 60 * 60 + (+a[1]) * 60 + (+a[2]);
            var t = new Date(1970, 0, 1);
            t.setSeconds(seconds);
            GameState.time_left_ply = t;
            Field.update(); 
        });
    },
    
    processActionResult: function (result) {
        
        // ensure we have a result
        if (result) {
            // has the result changed?
            if (!_.isEqual(result, GameState.last_result)) {
                // debug
                //console.log(PP(result));
                // have any results been missed?
                if (result.num === GameState.last_last_result.num + 1) {
                    // if not, just apply the result itself
                    GameState.applyResults(result);
                    GameState.updateActionNumber(result.num);
                } else {
                    // process state because we missed some results
                    GameState.updateState();
                }
                // pesist results
                GameState.last_last_result = GameState.last_result;
                GameState.last_result = result;
                //Field.update();
                Field.computeRanges();
            }
            return result.result;
        }
    },
    
    applyResults: function (result) {
        console.log("applying result.");
        var cmd = result.command;
        var res = result.response;
        var type = cmd.type;
        
        // check for applied damage
        if (result.applied) {
            apply_dmgs(result.applied);
        }
        
        // update results
        if (type == "move") {
            console.log("Moving Scient.");
            GameState.battlefield.move_scient(cmd.unit, cmd.target)
        } else if (type == "attack") {
            apply_dmgs(res.result)
        }
        
        function apply_dmgs (damages) {
            for (var d in damages) {
                var damage = damages[d];
                console.log("applying damge from result.");
                GameState.battlefield.apply_dmg(damage[0], damage[1]);
            }
        }
    },
    
    updateActionNumber: function (num) {
        GameState.action_count = num;
        if ((GameState.action_count % 2) === 1) { //does the action have an odd number?
            GameState.ply_no = Math.ceil(GameState.action_count / 2);
            if ((GameState.action_count % 4) === 1) {
                GameState.turn_no = Math.ceil(GameState.ply_no / 2);
            }
        }
        if ((GameState.ply_no % 2) === 1) { //ply_no determines whose_action it is.
            GameState.whose_action = GameState.player_names[0];
        } else {
            GameState.whose_action = GameState.player_names[1];
        }
    },
    
    updateState: function () {
        var last_state = battleService.get_last_state();
        var state = undefined;
        last_state.then(function(state) {
            if (state != null) {
                if (state.locs) { 
                    // when is state ever false?
                    // the first turn when there is no last_state.
                    // also when 'turn' advances (not ply)
                    
                    //NOTE: THIS IS WHAT ACTUALLY CHANGES THE GAME STATE.
                    GameState.battlefield.apply_HPs(state.HPs);
                    GameState.updateUnitLocations(state.locs);
                } else {
                    console.log("GameState.update is false.");  // ??
                }
                GameState.updateActionNumber(state.num + 1);
            }
        });
    },
    
    updateUnitLocations: function(locs) {
        var change = false;
        for (var ID in locs) {
            var loc = locs[ID];
            var unit = this.battlefield.units[ID];
            if (!_.isEqual(unit.location, loc)) {
                var oldX = unit.location[0];
                var oldY = unit.location[1];
                var newX = loc[0];
                var newY = loc[1];
                this.battlefield.grid.tiles[oldX][oldY].contents = null;
                this.battlefield.grid.tiles[newX][newY].contents = unit;
                unit.location = loc;
                change = true;
            }
        }

        this.battlefield.locs = locs;
        this.locs = locs;   // we should try to only have one reference to locs - is the right one in battlefield?
        return change;
    },
    
    getUnitById: function(id) {
        if (this.units[id]) {
            return this.units[id];
        }

        return false;
    },
    
    getUnitByName: function(name) { //buggy?
        for (var id in this.units) {
            var unit = this.units[id];
            if (unit.scient && unit.scient.name == name) return unit;
            if (unit.nescient && unit.nescient.name == name) return unit;
        }

        return false;
    },
    
    getUnitIdByName: function(name) {
        for (var id in this.units) {
            var unit = this.units[id];
            if (unit.scient && unit.scient.name == name) return id;
            if (unit.nescient && unit.nescient.name == name) return id;
        }

        return false;
    },
    
    getUnitIdByContents: function(contents) {
        if (contents.scient) return this.getUnitIdByName(contents.scient.name);
        if (contents.nescient) return this.getUnitIdByName(contents.nescient.name);

        return false;
    },
    
    getUnitIdByLocation: function(x, y) {
        for (var l in this.locs) {
            if (this.locs[l][0] == x && this.locs[l][1] == y) return l;
        }

        return false;
    },
    
    move: function(args){
        var self = this;
        var type = "move";
        var unitID = args.unitID || "";
        var targetLocation = args.targetLocation || [0,0];
        
        //Example 
        //battleService.process_action(["48632008", "move", [2, 2]])
        var action = battleService.process_action([
            unitID, //Unit
            type, //Type
            targetLocation //Target
        ]);
        
        action.addCallback(function(res){
            var response = res.response;
            if (response) {
                var results = self.processActionResult(response);
            }
        });
        
        action.addErrback(function(response){
            ui.showMessage({message: response});
            return response;
        });
        
        return action;
    },
    
    attack: function(args){
        var self = this;
        var type = "attack";
        var unitID = args.unitID || "";
        var targetLocation = args.targetLocation || [0,0];
        
        //Example???
        //battleService.process_action(["48632008", "attack", [2, 2]])
        var action = battleService.process_action([
            unitID, //Unit
            type, //Type
            targetLocation //Target
        ]);
        
        action.addCallback(function(res){
            var response = res.response;
            if (response) {
                var results = self.processActionResult(response);
            
                if (results) {
                    var messages = [];
                    for (var r in results) {
                        var result = results[r];
                        var ID = result[0];
                        var damage = result[1];
                        var unit = GameState.battlefield.units[ID];
                        if (damage === "Dead.") {
                            messages.push(unit.owner + "'s " + unit.name + " defeated.");
                        } else {
                            messages.push(unit.owner + "'s " + unit.name + " took " + damage + " damage.");
                        }
                        ui.showMessage({ message: messages.join("<br>") });
                    }
                }
            }
            return response;
        });
        
        action.addErrback(function(response){
            ui.showMessage({message: response});
            return response;
        });
        
        return action;
    },
    
    pass: function(args){
        var self = this;
        var type = "pass";
        var action = battleService.process_action([
            null,
            type, //Type
            null
        ]);
        
        action.addCallback(function(res){
            var response = res.response;
            if (response) {
                var results = self.processActionResult(response);
            }
            ui.showMessage({message: "You have passed for one action."});
            return response; 
            
        });
        
        action.addErrback(function(response){
            ui.showMessage({message: response});
            return response;
        });
    }
};
