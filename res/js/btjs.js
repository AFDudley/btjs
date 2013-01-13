var _intervalUpdateState;
var GameState = {
    grid: undefined,
    locs: undefined,
    owners: undefined,
    start_time: undefined,
    time_left: undefined,
    units: undefined,
    HPs: undefined,
    whose_action: undefined,
    player: "",
    action_count: 1,
    ply_no: 1,
    turn_no: 1,
    myUnits: undefined,
    theirUnits: undefined,
    battlefield: undefined,
    last_result: { num: 0 },
    last_last_result: { num: 0 },

    //This init function is bad, it should check the current state AND initial_state.
    init: function(cb) {
        // get username
        var getUsername = Services.battle.get_username();
        getUsername.then(function(username) {
            GameState.player = username;
            
            // get initial state
            var getInitialState = Services.battle.initial_state();
            getInitialState.then(function(res) {
                
                //scope?
                GameState.init_state = res.initial_state;
                GameState.grid = res.initial_state.grid.grid;
                GameState.locs = res.initial_state.init_locs;
                GameState.owners = res.initial_state.owners;
                GameState.start_time = res.initial_state.start_time;
                GameState.units = res.initial_state.units;
                GameState.player_names = res.initial_state.player_names;
                GameState.whose_action = GameState.player_names[0];

                //TODO Calculate HPs
                GameState.HPs = [];
                for (var key in GameState.units) {
                    GameState.HPs[key] = 0;
                }
                GameState.battlefield = new Battlefield(GameState.grid, GameState.locs, GameState.owners);
                
                // execute callback
                cb();
            });
        });
    },
    
    update: function() {
        var response = Services.battle.last_result();
        response.then(GameState.processActionResult);
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
            }
        }
    },
    
    applyResults: function (result) {
        var cmd = result.command;
        var res = result.response;
        var type = cmd.type;
        
        // check for applied damage
        if (result.applied) {
            apply_dmgs(result.applied);
        }
        
        // update results
        if (type == "move") {
            Battlefield.move_scient(cmd.unit, cmd.target)
        } else if (type == "attack") {
            apply_dmgs(res.result)
        }
        
        function apply_dmgs (damages) {
            for (var d in damages) {
                var damage = damages[d];
                Battlefield.apply_dmg(damage[0], damage[1]);
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
        
        // TODO: 
        // if so request the missing results and apply them
            // GameState.applyResults(result)
            // GameState.updateActionNumber(result.num)  
        
        var last_state = Services.battle.get_last_state();
        var state = undefined;
        last_state.then(function(state) {
            if (state != null) { //Catches the first turn when there is no last_state.
                if (state.locs) { //when is this ever false?
                    //NOTE: THIS IS WHAT ACTUALLY CHANGES THE GAME STATE.
                    GameState.clearGridContents();
                    GameState.HPs = state.HPs;
                    GameState.updateUnitLocations(state.locs);
                } else {
                    console.log("GameState.update is false.");
                    //return true;
                }
            }
            GameState.updateActionNumber(state.num + 1);
        });
    },
    
    clearGridContents: function() {
        for (var x in this.grid.tiles) {
            for (var y in this.grid.tiles[x]) {
                var tile = this.grid.tiles[x][y].tile;
                tile.contents = null;
            }
        }
    },
    
    updateUnitLocations: function(locs) {
        var change = false;
        for (var l in locs) {
            if (this.units[l].location != locs[l]) {
                this.units[l].location = locs[l];
                this.grid.tiles[this.units[l].location[0]][this.units[l].location[1]].tile.contents = null;
                this.grid.tiles[locs[l][0]][locs[l][1]].tile.contents = this.units[l];
                change = true;
            }
        }

        this.locs = locs;
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

    print: function() {
        console.log("userID        Loc Owner HPs");
        for (var puserID in this.locs) {
            console.log("\t" + puserID + ": " + this.locs[puserID] + " " + this.owners[puserID] + "\t" + this.HPs[puserID]);
        }
    },
    
    move: function(args){
        var type = "move";
        var unitID = args.unitID || "";
        var targetLocation = args.targetLocation || [0,0];
        
        //Example 
        //Services.battle.process_action(["48632008", "move", [2, 2]])
        var action = Services.battle.process_action([
            unitID, //Unit
            type, //Type
            targetLocation //Target
        ]);
        
        action.addCallback(function(response){
            //TODO Update Gamestage field -- (We'll get the field update on the next long poll)
            if(response.response.result){
                //TODO check for applied damage.
                var unitID = response.response.result[0][0];
                var targetLocation = response.response.result[0][1];
                console.log("move result: " + targetLocation);
                var unit = GameState.getUnitById(unitID);
                console.log(unit);
                if(unit){
                    if(unit.scient){
                        GameState.battlefield.move_scient(unitID, targetLocation);
                        unit.scient.location = targetLocation;
                    }else if(unit.nescient){
                        unit.nescient.location = targetLocation;
                    }
                }
                UI.setLeftUnit();
                UI.setRightUnit();
            }
            Field.update();
            return response; 
        });
        
        action.addErrback(function(response){
            UI.showMessage({message: response});
            return response;
        });
    },
    
    attack: function(args){
        var type = "attack";
        var unitID = args.unitID || "";
        var targetLocation = args.targetLocation || [0,0];
        
        //Example???
        //Services.battle.process_action(["48632008", "attack", [2, 2]])
        var action = Services.battle.process_action([
            unitID, //Unit
            type, //Type
            targetLocation //Target
        ]);
        
        action.addCallback(function(response){
            //TODO Update Gamestage field -- (We'll get the field update on the next long poll)
            if(response.response.result){
                //TODO correctly handle wand/bow attacks (use a for each).
                //TODO check for applied damage.
                UI.setLeftUnit();
                UI.setRightUnit();
                if(response.response.result[0][1] != "Dead."){
                    var unitID = response.response.result[0][0];
                    var amount = response.response.result[0][1];
                    console.log("unitID: " + unitID);
                    console.log("amount: " + amount);
                    GameState.battlefield.apply_dmg(unitID, amount);
                    UI.showMessage({message: amount + " Damage."});
                }else{
                    GameState.battlefield.bury(unitID);
                    UI.showMessage({message: "Unit defeated."});
                }
            }
            Field.update();
            return response;
        });
        
        action.addErrback(function(response){
            UI.showMessage({message: response});
            return response;
        });
    },
    
    pass: function(args){
        var type = "pass";
        
        var action = Services.battle.process_action([
            null,
            type, //Type
            null
        ]);
        
        action.addCallback(function(response){
            UI.showMessage({message: "You have passed for one action."});
            return response; 
        });
        
        action.addErrback(function(response){
            UI.showMessage({message: response});
            return response;
        });
    }
};
