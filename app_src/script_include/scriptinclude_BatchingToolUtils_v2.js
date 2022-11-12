var BatchingToolUtils_v2 = Class.create();
BatchingToolUtils_v2.prototype = {
    initialize: function() {
        gs.include('j2js');
        gs.include('underscorejs.min');

        gs.include('JavascriptPolyfills'); // string.includes

        // trim polyfill
        String.prototype.trim = function() {
            return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
        };
    },
	
	/**
	  log message to servicenow log
	  @method _debug
	  @param {string}
	*/
	_debug : function(p_msg){
		var do_debug = gs.getProperty('openapp.update_set.deployment.automation.batching_tool.debug').toString().toLowerCase().trim();
		if (do_debug == 'true'){
			gs.log(p_msg, this.type);
		}
	},
	
	
    /**
      @mehtod batch
      @param {string} update set sys_id
      @param {string} parent update set sys_id 
      @returns {boolean} true if record updated
    */
    batch: function(p_updateset_sysid, p_parent_updateset_sysid) {
        var result = false;

        if (JSUtil.notNil(p_updateset_sysid) && JSUtil.notNil(p_parent_updateset_sysid)) {

            var gr = new GlideRecord('sys_update_set');
            if (gr.get(p_updateset_sysid)) {
                gr.parent = p_parent_updateset_sysid;
                gr.update();
                result = true;
            }
        }
        return result;

    },

    /**
      @mehtod unbatch
      @param {string} update set sys_id
      @param {string} optional update set name (search by name if sys_id unknown)
      @returns {boolean} true if record updated
    */
    unbatch: function(p_updateset_sysid, p_updateset_name) {
        var result = false;
        var updateset_sysid = p_updateset_sysid;
        if (JSUtil.notNil(p_updateset_name)) {
            var list = this.findUpdateSets([p_updateset_name]);
            if (list.length) {
                updateset_sysid = list[0].sys_id;
            }

        }
        if (JSUtil.notNil(updateset_sysid)) {
            var gr = new GlideRecord('sys_update_set');
            if (gr.get(updateset_sysid)) {
                gr.parent = '';
                gr.update();
                result = true;
            }
        }

    },

    /**
      @method getParentUrl
      @param {string} sys_id
      @returns {string}
    */
    getParentUrl: function(sys_id) {
        var result = '';
        if (JSUtil.notNil(sys_id)) {
            var gr3 = new GlideRecord('sys_update_set');
            if (gr3.get(sys_id)) {
                parent_url = gs.getProperty('glide.servlet.uri') + gr3.getLink(false);
            }
        }
        return result;

    },


    /**
      @method findUpdateSets
    */
    findUpdateSets: function(p_list, p_app_scope) {
        var result = [];
        var gr2, gr4;
        var obj;
        if (JSUtil.notNil(p_list) && p_list.length) {

            _.each(p_list, function(v1, k1) {
                if (JSUtil.notNil(v1.trim())) {
                    // created after upgrade
                    gr2 = new GlideRecord('sys_update_set');
                    gr2.addQuery('state', 'complete');
                    gr2.addQuery('name', 'STARTSWITH', v1.trim());
                    if (!gs.nil(p_app_scope)) {
                        gr2.addEncodedQuery('application.name=' + p_app_scope);
                    }
                    obj = {};
                    gr2.query();
                    var added = false;
                    if (gr2.next()) {
                        // ensure update set not already in the list to return
                        var duplicate = _.find(result, function(v) {
                            v.name === j2js(gr2.name);
                        });
                        // ensure itme found in query is 100% match for item in list
                        if (JSUtil.nil(duplicate) && (v1.trim().toLowerCase() === j2js(gr2.name).trim().toLowerCase())) {
                            obj = {
                                'name': j2js(gr2.name),
                                'sys_id': j2js(gr2.sys_id),
                                'found': true,
                                'url': gs.getProperty('glide.servlet.uri') + gr2.getLink(false),
                                'parent_sysid': j2js(gr2.parent),
                                'parent_name': j2js(gr2.parent.name),
                                'parent_url': this.getParentUrl(gr2.parent),
                                'duplicate': false,
                                'scope': j2js(gr2.application.name),
                                'scope_sysid': j2js(gr2.application),
                            };
                            if (gr2.getRowCount() > 1) { // if update set in local table more than once
                                obj.duplicate = true;
                            }
                            added = true;
                            result.push(obj);
                        }

                    } else {
                        // try a contains query
                        gr4 = new GlideRecord('sys_update_set');
                        gr4.addQuery('state', 'complete');
                        gr4.addQuery('name', 'CONTAINS', v1.trim());
                        if (!gs.nil(p_app_scope)) {
                            gr4.addEncodedQuery('application.name=' + p_app_scope);
                        }
                        gr4.query();
                        obj = {};
                        if (gr4.next()) {
                            var duplicate = _.find(result, function(v) {
                                v.name === j2js(gr4.name);
                            });
                            // ensure itme found in query is 100% match for item in list
                            if (JSUtil.nil(duplicate) && j2js(gr4.name).trim().toLowerCase().includes(v1.trim().toLowerCase())) {
                                obj = {
                                    'name': j2js(gr4.name),
                                    'sys_id': j2js(gr4.sys_id),
                                    'found': true,
                                    'url': gs.getProperty('glide.servlet.uri') + gr4.getLink(false),
                                    'parent_sysid': j2js(gr4.parent),
                                    'parent_name': j2js(gr4.parent.name),
                                    'parent_url': this.getParentUrl(gr4.parent),
                                    'duplicate': false,
                                    'scope': j2js(gr4.application.name),
                                    'scope_sysid': j2js(gr4.application),
                                };
                                if (gr4.getRowCount() > 1) { // if update set in local table more than once
                                    obj.duplicate = true;
                                }
                                added = true;
                                result.push(obj);
                            }
                        }
                    }

                    if (!added) {
                        result.push({
                            'name': j2js(v1.trim()),
                            'sys_id': '',
                            'found': false,
                            'url': '',
                            'parent': '',
                            'parent_url': '',
                            'duplicate': false,
                            'scope': '',
                        });
                    }
                }
            });

        }
        return result;
    },


    /****************************************************
         legacy functions above - new function below
         Sept 2022
    *****************************************************/

	/**
      @method getParentUrlByName
      @param {string} update set name
      @returns {string}
    */
    getParentUrlByName: function(p_us_name) {
        var result = '';
		//gs.print(p_us_name);
        if (!gs.nil(p_us_name)) {
            var gr1 = new GlideRecord('sys_update_set');
			gr1.addQuery('name', p_us_name);
			gr1.orderByDesc('sys_created_on');
			//gs.print(gr1.getEncodedQuery())
			gr1.query();
            if (gr1.next()) {
                result = gs.getProperty('glide.servlet.uri') + gr1.getLink(false);
            }
        }
        return result;

    },
	
	
    /**
      take list of update sets (newline delimited string) and parse into an array
      method parseUpdateSetList
      @param {string} newline demimited list of update sets
      @returns {array}
    */
    parseUpdateSetList: function(p_updateset_list) {
        var result = [];
		var str_trim_tmp = '';
		var updateset_list = p_updateset_list.toString();
        if (!gs.nil(updateset_list) && updateset_list.length) {
            var updateset_arr = updateset_list.split("\n");
            updateset_arr.forEach(function(p_line) {
				//this._debug('parseUpdateSetList - loop: '+p_line);
                str_trim_tmp = '';
				str_trim_tmp = p_line.trim();
				if (str_trim_tmp.length) {
                    result.push(str_trim_tmp);
                }
            }, this);
			
        }
        return result;

    },

    /**
      use update set name to get the update set glide record reference
      @method getUpdateSetGlideRecord
      @param {string} update set name
      @returns {object} glide record reference
    */
    getUpdateSetGlideRecord: function(p_updateSetName) {
        var result;
        var updateset_sysid = this.findLocalUpdateSet(p_updateSetName);
        if (!gs.nil(updateset_sysid)) {
            var gr1 = new GlideRecord('sys_update_set');
            if (gr1.get(updateset_sysid)) {
                result = gr1;
            }
        }

        return result;
    },
	
	  /**
      @method getApplicationScopeSysid
      @param {string} application scope name
    */
    getApplicationScopeSysid: function(p_scopeName) {
        var result = '';
		
		if (gs.nil(p_scopeName)){
			p_scopeName = gs.getProperty('openapp.update_set.deployment.automation.scope.global.id','global');
		}
		
        if (!gs.nil(p_scopeName)) {
            var gr1 = new GlideRecord('sys_scope');
            gr1.addQuery('name', p_scopeName);
            gr1.query();
            if (gr1.next()) {
                result = gr1.sys_id.toString();
            }
        }
        return result;

    },


	/**
	  search an array of objects in format {'name':'', 'sysid':''}
	  if the array contains and entry, return true
	  @method isUpdateSetNameInArray
	  @param {string} update set name
	  @param  {array} array of objects, containing update set and and sys_id
	  @return {boolean}
	*/
	isUpdateSetNameInArray: function(p_us_name, p_arr){
		var result = false;
		if (!gs.nil(p_us_name) && !gs.nil(p_arr)){
			for (var i=0; i < p_arr.length; i++){
				if (Object.keys(p_arr[i]).length && p_arr[i].name && p_arr[i].name.length){
					if (p_arr[i].name == p_us_name){
						result = true;
						break;
					}
				}
			}
		}

		return result;
	},
	
	
    /**
      get alist of all app scopes that occur in a list of update sets
      @method getUpdateSetsAppScopeInfo
      @param {array} list of upate set names
      @return {array} array of object
    */
    getUpdateSetsAppScopeInfo: function(p_updateSetList) {
        var result = []; // list of objects - app scope name and sysid
        var usGR;
		
		/* local function - verify no dulicate entries exist in result, search by sys_id*/
		var isRecordInArr = function(p_app_sysid, p_arr){
			var isFound = false;
			// loop through result 
			for (var i=0; i < p_arr.length; i++){
				if (Object.keys(p_arr[i]).length && p_arr[i].sysid && p_arr[i].sysid.length){
					if (p_arr[i].sysid == p_app_sysid){
						isFound = true;
						break;
					}
				}
			}
			return isFound;
		}; // end local fx
		
		// process update set list
        if (!gs.nil(p_updateSetList)) {
            p_updateSetList.forEach(function(updateset_name) {
                usGR = this.getUpdateSetGlideRecord(updateset_name);
                var app_scope_sysid = usGR.application.toString();
				if (!gs.nil(usGR) && !isRecordInArr(app_scope_sysid, result)) {
                    result.push({
                        'sysid': app_scope_sysid,
                        'name': usGR.application.name.toString(),
                    });
                }
            }, this);
        }

        return result;

    },


    /**
      search for an update set in the local update sets 
      @method findLocalUpdateSet
      @param {string} update set name
      @returns {string} target record sys_id
    */
    findLocalUpdateSet: function(p_updateset_name) {
        var result = '';
        if (!gs.nil(p_updateset_name)) {
            // search first with 'starts with' query
            var gr1 = new GlideRecord('sys_update_set');
            gr1.addQuery('state', 'complete');
            gr1.addQuery('name', 'STARTSWITH', p_updateset_name.trim());
			gr1.orderByDesc('sys_created_on');
            gr1.query();
            if (gr1.next()) {
                result = gr1.sys_id.toString();
            } else {
                // not found, retry search using "contains" query
                var gr2 = new GlideRecord('sys_update_set');
                gr2.addQuery('state', 'complete');
                gr2.addQuery('name', 'CONTAINS', p_updateset_name.trim());
				gr2.orderByDesc('sys_created_on');
                gr2.query();
                if (gr2.next()) {
                    result = gr2.sys_id.toString();
                }
            }
        }

        return result;
    },

    /**
      for a given array of update sets, veryify each update set can be found in local update sets table
      @method allUpdateSetsFound
      @param {array} array of update sets names
      @returns {boolean}
    */
    allUpdateSetsFound: function(p_updateset_arr) {
        var result = false;
        if (!gs.nil(p_updateset_arr)) {

            var not_found_update_sets = this.getUpdateSetsNotFound(p_updateset_arr);
            if (not_found_update_sets.length == 0) {
                result = true;
            }
        }

        return result;

    },
	
	/**
	  verify for an array of update sets, that all update sets are:
	  1. found on local update sets table in completed state
	  2. all update set names are all singular. for all update sets, where the  
	  state is "completed", each update set occurs in the local update set table no more than 1x 
	
	  @method isCriticalBatchingError
	  @param {array} list of all update set names
	  @return {boolean}  
	*/
	isCriticalBatchingError : function(p_updateset_name_arr){
		var result = true;
		var validated = false;
		if (!gs.nil(p_updateset_name_arr) && p_updateset_name_arr.length){
			 if (this.allUpdateSetsFound(p_updateset_name_arr)) {
			    if (this.noDuplicateUpdateSetsFound(p_updateset_name_arr)){
				     validated = true;
				}
			 }
		}
		if (validated) result = false; // no errors found
		return result;
	},	
	
	/**
	  verify for a list of update sets, that no update set name occurs more than 1x where state = completed
	  @method noDuplicateUpdateSetsFound
	  @param {array}
	  @returns {boolean}
	*/
	noDuplicateUpdateSetsFound: function(p_updateset_name_arr){
		var result = false;
		var no_duplicates_found = true;
		if (!gs.nil(p_updateset_name_arr) && p_updateset_name_arr.length){
			// search through all update sets, if any update sets found, set flag no_dups_found to false
			for(var i=0; i< p_updateset_name_arr.length; i++){
				if (this.isDuplicateUpdateSet(p_updateset_name_arr[i])){
					no_duplicates_found = false;
					break;
				}
			}
		}
		if (no_duplicates_found) result = true; 
		return result;
	},
	
	/**
	  verify update set does not have more than 1 record in completed state
	  in local update set table 
	  @method this.isDuplicateUpdateSet(p_updateset_name_list[i])
	  @param {string}
	  @return {boolean}
	
	*/
    isDuplicateUpdateSet : function(p_updateset_name){
		var result = false;
		var ga1, gr1;
		var app_scope_arr = [];
	    var app_scope_name = '';
		//this._debug('isDuplicateUpdateSet - param: '+p_updateset_name);
		if (!gs.nil(p_updateset_name) && p_updateset_name.toString().length ){
			this._debug('isDuplicateUpdateSet - run glide aggrgate query');
			ga1 = new GlideAggregate('sys_update_set');

			ga1.addEncodedQuery('nameLIKE'+p_updateset_name+'^state=complete');
			// Add aggregate  
			ga1.addAggregate('COUNT');
			// only return results for items with count greater than 1
            ga1.addHaving('COUNT', '>', 1);
			// Execute query 
			ga1.query();

			// Process returned records
			if(ga1.next()){
				this._debug('isDuplicateUpdateSet query result: '+p_updateset_name+' - '+ga1.getAggregate('COUNT'));
				// verify if the app scope is unique for each update set
				gr1 = new GlideRecord('sys_update_set');
				gr1.addEncodedQuery('nameLIKE'+p_updateset_name+'^state=complete');
				gr1.query();
				while(gr1.next()){
					app_scope_name = gr1.application.name.toString();
					//if (!app_scope_arr.includes(app_scope_name)){  // array.includes not working
					if (app_scope_arr.indexOf(app_scope_name) < 0){
						app_scope_arr.push(app_scope_name);
					}
					
				}
				this._debug('isDuplicateUpdateSet - check app scope for duplicate name - app scopes: '+app_scope_arr.length+', update sets: '+ga1.getAggregate('COUNT'));
				if (app_scope_arr.length != ga1.getAggregate('COUNT') ){
					result = true;
				}
				
			}
		}
		
		/**
		unit test
		var util = new BatchingToolUtils_v2()
		var result = util.isDuplicateUpdateSet('CHG0000123456_1.0_BATCH_PARENT_global_2022-10-12');
		gs.print('test: '+result)
		*/
		return result;
	},
	
	/**
      for a given array of update set names, identify which update sets are NOT committed to local instance
      @method getUpdateSetsNotFound
      @param {array} array of update sets names to search for
      @returns {array} array of update set names not found on instance
    */
    getUpdateSetsNotFound: function(p_updateset_arr) {
        var result = [];
        if (!gs.nil(p_updateset_arr)) {
			// search for each individual update set
            p_updateset_arr.forEach(function(updateset_name) {
                var us_sysid = this.findLocalUpdateSet(updateset_name);
                if (gs.nil(us_sysid)) {
					// update set not found, add to list of not found 
                    result.push(updateset_name);
                }
            }, this);
        }

        return result;

    },


    /**
      @method setUpdateSetParent
      @param {string} child update set sys_id
      @param {string} parent update set sys_id 
    
    */
    setUpdateSetParent: function(p_childUpdatesetSysid, p_parentUpdatesetSysid) {

        if (!gs.nil(p_childUpdatesetSysid)) {
            var gr1 = new GlideRecord('sys_update_set');
            if (gr1.get(p_childUpdatesetSysid)) {
                gr1.parent = p_parentUpdatesetSysid;
                gr1.update();

            }
        }


    },

    /**
      @method createUpdateSet
      @param {string} update set name
      @param {string} application scope sys_id
      @return {string} update set sys_id
      
    */
    createUpdateSet: function(p_name, p_appScopeSysid, parent_updateset_sysid) {
        var result = '';
		
		if (gs.nil(p_appScopeSysid)){
			p_appScopeSysid = gs.getProperty('openapp.update_set.deployment.automation.scope.global.id','global');
		}
		
        if (!gs.nil(p_name)) {
			// if duplicate name exists, set current update set to state = ignore
			var gr1 = new GlideRecord('sys_update_set');
			gr1.addQuery('name', p_name);
			gr1.addQuery('application', p_appScopeSysid);
			gr1.query();
			while(gr1.next()){
				gr1.state='ignore';
				gr1.update();
			}
			
			// create new update set
            var gr2 = new GlideRecord('sys_update_set');
            gr2.initialize();
            gr2.name = p_name;
            gr2.application = p_appScopeSysid;
			if (!gs.nil(parent_updateset_sysid)){
				gr2.parent = parent_updateset_sysid;
			}
            result = gr2.insert();

        }
        return result;
    },

    /**
      @method createBatchUpdateSetName
      @param {string} chg ticket number / prefix
      @param {string} version
      @param {boolean} flag for is topmost batch parent
      @return {string}
    */
    createBatchUpdateSetName: function(p_prefix, p_version, p_app_scope_name, p_batch_parent_flag) {
        var result = '';
        var gdt = new GlideDateTime();
		// get date
        var current_date = gdt.getDate();
		// get time
		var ms = gdt.getNumericValue(); // get milliseconds
		var dt = new Date(ms);
		var current_time = dt.getUTCHours()+'-'+dt.getUTCMinutes();
        if (!gs.nil(p_prefix)) {
            // naming format: <prefix>_v<version>.0_BATCH_<app_scope_name_short>_<DATE>
            // naming format - global batch parent:  <prefix>_v<version>.0_BATCH_PARENT_GLOBAL_<DATE>
            // ex1: CHG00001234_v1.0_BATCH_PARENT_GLOBAL_2022_08_31
            // ex2: CHG00001234_v1.0_BATCH_GLOBAL_2022_08_31
            if (p_batch_parent_flag.toString().toLowerCase().trim() == 'true') {
                // global batch parent
				result = p_prefix + "_" + p_version + "_BATCH_PARENT_" + p_app_scope_name.substring(0, 15) + "_" + current_date+'_'+current_time;
            } else {
				// app scope batch
                result = p_prefix + "_" + p_version + "_BATCH_" + p_app_scope_name.substring(0, 15) + "_" + current_date+'_'+current_time;
            }

        }
        return result;
    },

    /**
	  create update set for either gloabl batch parent, or app scope batch parent
      @method createBatchParentUpdateSet
	  @param {string} prefix for update set name, change number
	  @param {string} app scope name - global
    */
    createBatchParentUpdateSet: function(p_updateset_name, p_app_scope_name) {
        var result = '';
		var scope_sysid = '';
		var update_set_version = '';
		var batch_update_set_name = '';
		
		if (gs.nil( p_app_scope_name)){
            p_app_scope_name = gs.getProperty('openapp.update_set.deployment.automation.scope.global.id', 'global'); // default
		}
				
        if (!gs.nil(p_updateset_name)) {
	
			update_set_version = '1.0'; // TODO need to detect how many update sets already exist using same prefix
			// todo: this.setPreviousUpdateSetBatchesIgnore
			
			scope_sysid = this.getApplicationScopeSysid( p_app_scope_name );

			result = this.createUpdateSet(p_updateset_name, scope_sysid);
        }
        return result;
    },

  
	/**
	  get a list of update sets that match the application scope
	  @method getUpdateSetsByAppScopeId
	  @param {string} target application scope - sys_id
	  @param {array}  array of update set names
	  @return {array} array of objects with attributes "name", "sysid"
	  
	*/
	getUpdateSetsByAppScopeId : function(app_scope_sysid, p_updateset_name_arr){
		var result = [];
		var usGr;
		if (!gs.nil(app_scope_sysid) && !gs.nil(p_updateset_name_arr)){
			p_updateset_name_arr.forEach(function(updateset_name){
				usGr = this.getUpdateSetGlideRecord(updateset_name);
				if (!gs.nil(usGr)){
					if (usGr.application.toString() == app_scope_sysid.toString()){
						// do not allow duplicate entries
						if (!this.isUpdateSetNameInArray(updateset_name, result)){
							result.push({
								'name' : usGr.name.toString(),
								'sysid': usGr.sys_id.toString()
							});
						}
					}
				}
			}, this);
		}
		return result;
	},
	
	
	/**
	  set all the update sets to be under the batch parent for matching app scope
	  @method batchUpdateSets
	  @param {array} array of objects with attributes "name", "sysid", where each obejct represents and update set
	  @param {string} batch update set sys_id 
	  @return {integter} count of all batched update sets
	*/
	batchUpdateSets: function( p_us_arr, p_batch_us_sysid){
		var result = 0;  // count number of update sets added to batch
		if (!gs.nil(p_us_arr) && !gs.nil(p_batch_us_sysid)){
			//1 get batch update set scope
			var gr1;
			var gr2;
			gr1 = new GlideRecord('sys_update_set');
            if (gr1.get(p_batch_us_sysid)) {
                
				// 2 change scope
				this.changeCurrentAppScope(gr1.application);
				
				// 3. loop over update sets and set parent
				p_us_arr.forEach(function(obj){
					if (Object.keys(obj).length && obj.sysid){
						this.batch(obj.sysid, p_batch_us_sysid);
						result ++;
					}
					
				}, this);

				// 4. revert scope to global
				this.changeCurrentAppScope();
			}
		}
		return result;
		
	},
	
	/**
	  set upodate set state to completed
	  @method closeUpdateSet
	  @param {string} update set sys_id
	  
	  */
	  closeUpdateSet : function(p_us_sysid){
		  if (!gs.nil(p_us_sysid)){
			    var gr1 = new GlideRecord('sys_update_set');
				if (gr1.get(p_us_sysid)) {
					gr1.state = 'complete';  
					gr1.update();
				}
		  }
	  },
	

    /**
      https://community.servicenow.com/community?id=community_question&sys_id=b4fa07addb5cdbc01dcaf3231f961937
      change the currently selected app scope
      @method changeCurrentAppScope 
      @param {string} app scope sys_id
    */
    changeCurrentAppScope: function(p_scope_sysid) {
        if (!gs.nil(p_scope_sysid)) {
            gs.setCurrentApplicationId(p_scope_sysid);
        }
		else{
			// param empty, default to global
			var global_scope = this.util.getApplicationScopeSysid(); // default to global scope
			gs.setCurrentApplicationId(global_scope);
		}
    },

	
	/**
	  lookup the most recently created autobatch workflow execution context and return sys_id
	  @method getAutoBatchWorkflowContext
	  @return {string} workflow execution context sys_id
	*/
	getAutoBatchWorkflowContext: function(){
		var result = '';
		// query: sys_created_on>=javascript:gs.beginningOfLastMinute()^nameSTARTSWITHUpdate-set auto-batching 
		
		var query = gs.getProperty('openapp.update_set.automation.autobatch.workflow_context_query.1min');
		if (!gs.nil(query)){
            var gr1 = new GlideRecord('wf_context');
			gr1.addEncodedQuery(query);
			gr1.orderByDesc('sys_created_on');
			gr1.query();
			if (gr1.next()){
				result = gr1.sys_id+'';
			}
		}
		return result;
	},
	
	/**
	  read workflow output from the autobatch process - output = update set batch name
	  @method getAutoBatchWorkflowResult
	  @param {string} executing workflow context sys_id
	  @return {string} global batch parent update set name
	*/
	getAutoBatchWorkflowResult : function(p_wf_context_sysid){
		var result = '';
		if (!gs.nil(p_wf_context_sysid)){
			var gr1 = new GlideRecord('wf_context');
			if (gr1.get(p_wf_context_sysid)){
				if(gr1.getValue('state').toString() == 'finished'){
					// from Nithin to everyone:
                     var wkfw = new Workflow();
					result = wkfw.getReturnValue(gr1);
                    // end Nithin to everyone
					this._debug('autobatchworkflowresult - worflow output: '+ wkfw.getReturnValue(gr1), this.type);
					
				}
			}
		}
		
		return result;
	},

	/**
	  launch the workflow to perform autobatching
	  @method startAutoBatchWorkflow
	  @param {string} chnage ticket number / update ste name prefix
	  @param {string} update set list
	  @return {string} workflow context sys_id
	*/
	startAutoBatchWorkflow : function(p_prefix, p_us_name_list){
		var result = '';
		if (!gs.nil(p_prefix) && !gs.nil(p_us_name_list)){
			this._debug('<start autobatch workflow> inputs:'+p_prefix+' - '+p_us_name_list);

			var wf = new Workflow();
			var wf_name = gs.getProperty('openapp.update_set.automation.autobatch.workflow_name'); // Update-set auto-deployment v1 
			var workflowId = wf.getWorkflowFromName(wf_name);
			this._debug("<start autobatch workflow>  - Workflow id: " + workflowId + ', ' + wf_name);
			
			var wf_params_obj = {
				'u_update_set_list': p_us_name_list,
				'u_change_ticket_number': p_prefix 
			};
			result = wf.startFlow(workflowId, '', '', wf_params_obj);
		}
		return result;
		
	},
	
	
    type: 'BatchingToolUtils_v2'
};
