var UpdateSetCommitAutomationUtil = Class.create();
UpdateSetCommitAutomationUtil.prototype = {
    initialize: function() {

        this.debug_enabled = (gs.getProperty('openapp.update_set.automation.debug').toString().toLowerCase().trim() == 'true');


        // queries for retrieved update set state

        // loading - check progress workers for active jobs loading update sets
        this.us_query_loading = gs.getProperty('openapp.update_set.automation.retrieved_query.loading');
        // loaded - state=loaded^ORstate=in_hierarchy
        this.us_query_loaded = gs.getProperty('openapp.update_set.automation.retrieved_query.loaded');
        // previewing - state=previewing
        this.us_query_previewing = gs.getProperty('openapp.update_set.automation.retrieved_query.previewing');
        // previewed - state=previewed^ORstate=previewed_in_hierarchy
        this.us_query_previewed = gs.getProperty('openapp.update_set.automation.retrieved_query.previewed');
        // committing - state=committing
        this.us_query_committing = gs.getProperty('openapp.update_set.automation.retrieved_query.committing');
        // committed - state=committed^ORstate=partial
        this.us_query_committed = gs.getProperty('openapp.update_set.automation.retrieved_query.committed');

    },


    /**
      print debug messages to system log
      @method _debug
      @param {string}
    */
    _debug: function(m) {
        if (this.debug_enabled) {
            gs.log(m, this.type);
        }

    },


    /**
        look in the progress workers table for any jobs currently loading update sets
       query: state=running^sys_created_onONToday@javascript:gs.beginningOfToday()@javascript:gs.endOfToday()^nameSTARTSWITHRetrieving update sets
       @method areUpdateSetsLoadingFromRemote
       @return {booolean}
    */
    areUpdateSetsLoadingFromRemote: function() {
        var result = false;
        var gr1 = new GlideRecord('sys_progress_worker');
        gr1.addEncodedQuery(this.us_query_loading);
        gr1.query();
        if (gr1.hasNext()) {
            result = true;
            this._debug('areUpdateSetsLoadingFromRemote: detected remote load of update sets in progress');
        }

        return result;
    },

    /**
      verify if the update set contains xml records or child update sets
      @method isUpdateSetEmpty 
      @param {string} update set name
      @return {boolean}
    */
    isUpdateSetEmpty: function(p_updateset_name) {
        var result = true;
        var has_children = false;
        var has_customer_updates = false;
        if (!gs.nil(p_updateset_name)) {
            // check children
            var gr1 = new GlideRecord('sys_remote_update_set');
            gr1.addEncodedQuery('parent.nameSTARTSWITH' + p_updateset_name);
            this._debug('isUpdateSetEmpty - query 1 - ' + gr1.getEncodedQuery());
            gr1.query();
            if (gr1.hasNext()) {
                result = false;
            }
            // check customer xml
            gr1 = new GlideRecord('sys_update_xml');
            gr1.addEncodedQuery('remote_update_set.nameSTARTSWITH' + p_updateset_name);
            this._debug('isUpdateSetEmpty - query 2 - ' + gr1.getEncodedQuery());
            gr1.query();
            if (gr1.hasNext()) {
                result = false;
            }

        }

        return result;
    },

    /**
      use the update set name from the retrieved update set table 
	  and return the reference to the matching db record
      @method  getRetrievedUpdateSetGR
      @param {string} Update Set name
	  @param {string} encoded query to appl to the ticket search - used for checking state
      @returns {object} gliderecord reference
    */
    getRetrievedUpdateSetGR: function(p_updateset_name, p_additional_query) {
        var result;
        if (!gs.nil(p_updateset_name)) {
            var gr1 = new GlideRecord('sys_remote_update_set');
            gr1.addEncodedQuery('sys_class_name=sys_remote_update_set');
            if (!gs.nil(p_additional_query)) {
                // apply an additional filter condition before attempting to retrieve the target record
                // used for checking state
                gr1.addEncodedQuery(p_additional_query);
            }
            var qc = gr1.addQuery('name', 'STARTSWITH', p_updateset_name.trim());
			qc.addOrCondition('name', "CONTAINS", p_updateset_name.trim());
            this._debug('getRetrievedUpdateSetGR - query :' + gr1.getEncodedQuery());
            gr1.query();
            if (gr1.next()) {
				this._debug('getRetrievedUpdateSetGR - record found '+gr1.sys_id+' matching query:' + gr1.getEncodedQuery());
                result = gr1;
            }
			else{
				this._debug('getRetrievedUpdateSetGR - record not found for query:' + gr1.getEncodedQuery());
			}
        }
        return result;
    },

    /**
      return if the update set is in the followig states
      - not loaded
      - loading
      - loaded
      - previewing
      - previewed
      - committing
      - committed
      @method getUpdateSetState
      @param {string} update set name
      @return {string} 
    */
    getUpdateSetState: function(p_updateset_name) {
        result = 'not loaded';
        var state_check_gr = '';
        var usGR = this.getRetrievedUpdateSetGR(p_updateset_name);
        if (!gs.nil(usGR)) {
			this._debug('<getUpdateSetState> update set record found by name '+p_updateset_name+' - '+usGR.sys_id);
            // record found, detect state

            // loading state - how do we check if remote fetch from QA still running?
            if (this.areUpdateSetsLoadingFromRemote()) {
                result = 'loading';
            } else {
                state_check_gr = this.getRetrievedUpdateSetGR(p_updateset_name, this.us_query_loaded);
				this._debug('<getUpdateSetState> check if loaded: '+(!gs.nil(state_check_gr))+' - '+(state_check_gr.sys_id || 'empty'));
                if (!gs.nil(state_check_gr)) {
                    result = 'loaded';
                } else {
                    // is previewing
                    state_check_gr = this.getRetrievedUpdateSetGR(p_updateset_name, this.us_query_previewing);
                    if (!gs.nil(state_check_gr)) {
                        result = 'previewing';
                    } else {
                        // is previewed
                        state_check_gr = this.getRetrievedUpdateSetGR(p_updateset_name, this.us_query_previewed);
                        if (!gs.nil(state_check_gr)) {
                            result = 'previewed';
                        } else {
                            // is committing
                            state_check_gr = this.getRetrievedUpdateSetGR(p_updateset_name, this.us_query_committing);
                            if (!gs.nil(state_check_gr)) {
                                result = 'committing';
                            } else {
                                // is committed
                                state_check_gr = this.getRetrievedUpdateSetGR(p_updateset_name, this.us_query_committed);
                                if (!gs.nil(state_check_gr)) {
                                    result = 'committed';
                                }
                            }
                        } // end check is commiting /committed

                    } // end check if previewing / previewed

                } // end check if loaded

            } // end - check if loading	

        } // end check for update set
		else{
			this._debug('<getUpdateSetState> update set record NOT FOUND searching by name '+p_updateset_name);
		}
		this._debug('<getUpdateSetState> exit value: '+result);
        return result;

    },

    /**
	 delete all the update sets in retrieved table that are not committed and are older than today
	 taken from  sys_script_fix.do?sys_id=90d989e413617200279b51a63244b069
      @method deleteUncommittedUpdatsets
    
    */
    deleteUncommittedUpdatsets: function() {
        var gr = new GlideRecord('sys_remote_update_set');

        gr.addQuery('sys_class_name', 'sys_remote_update_set');
        gr.addEncodedQuery('state=in_hierarchy^ORstate=previewed^ORstate=previewed_in_hierarchy^ORstate=loaded ');
        // gr.addQuery('sys_created_on', '<', gs.daysAgoStart(0));
        gr.query();
        var deleted = 0;
        if (gr.hasNext()) {
            while (gr.next()) {
                this._debug(' deleteUncommittedUpdatsets - mark for delete: ' + gr.name);
            }
            deleted = gr.getRowCount();
            gr.deleteMultiple(); // remove comment chars at begining of line to active
        }
        this._debug('deleteUncommittedUpdatsets - deleted ' + deleted + ' update sets from retrieved table');

    },
	
	 /**
      start process to load update sets from remote instance (dev,QA)
	  taken from /sys_script_include.do?sys_id=b71e40d60a0a0b5c00df587b3123cb21
      @method startFetchUpdateSetsFromRemoteInstance
	  @retruns {sys_id} progress worker for remote fetch job
    */
    startFetchUpdateSetsFromRemoteInstance: function() {
        var result = '';
        // DEV - sys_update_set_source.do?sys_id=4832d23d4f15120003e387dab110c7f0
		// QA - sys_update_set_source.do?sys_id=3756ccd26fb611009a0f2d232e3ee4bd
        var qa_remote_update_source_sysid = gs.getProperty('openapp.update_set.automation.update_set_source.qa.sysid');
		var dev_remote_update_source_sysid = gs.getProperty('openapp.update_set.automation.update_set_source.dev.sysid');

		// default to DEV as target instance for remote pull 
		var target_update_set_souce = dev_remote_update_source_sysid;
		var instance_name = gs.getProperty('instance_name').toString().toLowerCase();
		// instance is preprod or prod, pull from QA
		if (instance_name.includes('prod')){
			target_update_set_souce = qa_remote_update_source_sysid;
			this._debug('<startFetchUpdateSetsFromRemoteInstance> - get completed update sets from QA instance');
		}
		else{
			this._debug('<startFetchUpdateSetsFromRemoteInstance> - get completed update sets from DEV instance (default)');
		}
		if (!gs.nil(target_update_set_souce)){
			// only pull from active endpoints
			var gr1 = new GlideRecord('sys_update_set_source');
			gr1.addActiveQuery();
			gr1.addQuery('sys_id', target_update_set_souce);
			gr1.query();
			if (gr1.next()){
				var worker = new GlideUpdateSetWorker();
				var sys_id = this.getParameter('sysparm_id');
				worker.setUpdateSourceSysId(target_update_set_souce);
				worker.setBackground(true);
				this._debug('<startFetchUpdateSetsFromRemoteInstance> - get completed update sets from remote instance');
				worker.start();
				result = worker.getProgressID().toString();

			}
			else{
				 this._debug('<startFetchUpdateSetsFromRemoteInstance> - Error: target remote source record not found or inactive ' + target_update_set_souce);
			}
		}
        return result;

    },

    /**
      start process to load update sets from remote instance (QA)
	  taken from /sys_script_include.do?sys_id=b71e40d60a0a0b5c00df587b3123cb21
      @method startFetchUpdateSetsFromQA
	  @retruns {sys_id} progress worker for remote fetch job
    */
    startFetchUpdateSetsFromQA: function() {
        var result = '';
        // https://metnext.service-now.com/nav_to.do?uri=sys_update_set_source.do?sys_id=3756ccd26fb611009a0f2d232e3ee4bd
        var qa_remote_update_source_sysid = gs.getProperty('openapp.update_set.automation.update_set_source.qa.sysid');

		// only pull from active endpoints
		var gr1 = new GlideRecord('sys_update_set_source');
		gr1.addActiveQuery();
		gr1.addQuery('sys_id', qa_remote_update_source_sysid);
		gr1.query();
		if (gr1.next()){
			var worker = new GlideUpdateSetWorker();
			var sys_id = this.getParameter('sysparm_id');
			worker.setUpdateSourceSysId(qa_remote_update_source_sysid);
			worker.setBackground(true);
			this._debug(' startFetchUpdateSetsFromQA - get completed update sets from QA');
			worker.start();
			result = worker.getProgressID().toString();
			
		}
		else{
			 this._debug('startFetchUpdateSetsFromQA - Error: target record not found or inactive ' + qa_remote_update_source_sysid);
		}
		
        return result;

    },
	
	/**
	  verify if the retrived updateset.parent field is populated or not
	  @method isChildUpdateSet
	  @param {string} update set name
	  @return {boolean} true if parent field is populated
	*/
    isChildUpdateSet : function(p_updateset_name){
		var result = false;
		var usGr = this.getRetrievedUpdateSetGR(p_updateset_name);
		if (!gs.nil(usGr)){
			if (usGr.sys_id.toString().length){
				if (!gs.nil(usGr.parent) && usGr.parent.name.toString().length){
					result = true;
				}
			}	
		}
		return result;
		
	},

    /**
      start process to preview update set
	  taken from sys_script_include.do?sys_id=dfed336047130200c17e19fbac9a71ec
      @method startUpdateSetPreview
      @param {string} update set name
	  @return {string} progress worker sys_id
    */
    startUpdateSetPreview: function(p_updateset_name) {
        var result = '';
        if (!gs.nil(p_updateset_name)) {
            var usGR = this.getRetrievedUpdateSetGR(p_updateset_name);
            if (!gs.nil(usGR)) {

                var preview_util = new HierarchyUpdateSetPreviewAjax();
                this._debug('startUpdateSetPreview - start preview for update set: ' + usGR.name);
                result = preview_util.previewRemoteHierarchyUpdateSet(usGR).toString();
            }
        }
        return result;
    },

    /**
      process preview warnings and errors for update set preview
      @method processUpdateSetPreviewResults
      @param {string} update set name
    */
    processUpdateSetPreviewResults: function(p_updateset_name) {
        var diag_mode = gs.getProperty('openapp.update_set.automation.commit_workflow.preview_error_processing.debug', 'false').toString().toLowerCase() == 'true';
		this._debug('processUpdateSetPreviewResults - START - diag mode ='+diag_mode, this.type);
		var preview_problem_query = gs.getProperty('openapp.update_set.automation.commit_workflow.preview_problem.query');
		
		
		if (!gs.nil(p_updateset_name) && !gs.nil(preview_problem_query)) {
            // preview problems found in sys_update_preview_problem
            //status=^sys_created_onONToday@javascript:gs.beginningOfToday()@javascript:gs.endOfToday()
            var gr1 = new GlideRecord('sys_update_preview_problem');
			// status=NULL
            //gr1.addEncodedQuery("type=error^status=NULL^sys_created_onONLast 15 minutes@javascript:gs.beginningOfLast15Minutes()@javascript:gs.endOfLast15Minutes()");
			
            gr1.addEncodedQuery(preview_problem_query);
			this._debug('processUpdateSetPreviewResults - query' + gr1.getEncodedQuery(), this.type);
			gr1.query();
            while (gr1.next()) {
                this._debug('processUpdateSetPreviewResults - ' + gr1.type + ' ' + gr1.missing_item + ' ' + gr1.description, this.type);

				// process preview errors
                // UI action - Accept remote update
                if (gr1.status.nil() ){
					
					// force to skip newer version found
					if (gr1.description.toString().includes('Found a local update') || gr1.description.toString().includes('is newer than this one') ){
						
						// UI Action "skip remote update"
						// sys_ui_action.do?sys_id=f6f5730c97410100d308124eda29758d
						if (gr1.available_actions.toString().contains("f6f5730c97410100d308124eda29758d")){
						     this._debug('processUpdateSetPreviewResults - skip action for newer version found - '+gr1.missing_item+' '+gr1.description);
						      if (!diag_mode){
								  var ppa = new GlidePreviewProblemAction(gs.action, gr1);
								  ppa.skipUpdate(); // skip newer version found
							  } else this._debug('processUpdateSetPreviewResults - no action - diag mode enabled');
						}	
						
					}
					// update set app scope error
					else if (gr1.description.toString().includes('conflicts within the update set with the same name') || gr1.description.toString().includes('Resolve the issue on the source system') ){
						// Accept the Collision
						if (gr1.available_actions.toString().contains("daaa839a47f31200ee1919fbac9a7159")){
							//  UI Action uri=sys_ui_action.do?sys_id=daaa839a47f31200ee1919fbac9a7159
							this._debug('processUpdateSetPreviewResults - accept collision - '+gr1.missing_item+' '+gr1.description);
							if (!diag_mode){
								var ppa = new GlidePreviewProblemAction(action, current);
								ppa.chooseCollisionWinner();
							} else this._debug('processUpdateSetPreviewResults - no action - diag mode enabled');
						}
					}
					// this should be a critical error an never get processed, but just in case, handler added below
					else if (gr1.description.toString().includes('Cannot commit Update Set') || gr1.description.toString().includes('Resolve the problem before committing') ){
						// Skip the update set warning
						if (gr1.available_actions.toString().contains("f6f5730c97410100d308124eda29758d")){
							//  UI Action uri=sys_ui_action.do?sys_id=f6f5730c97410100d308124eda29758d
							this._debug('processUpdateSetPreviewResults - Skip error (COMMIT WARNING) - '+gr1.missing_item+' '+gr1.description);
							if (!diag_mode){
								var ppa = new GlidePreviewProblemAction(action, current);
								ppa.skipUpdate();
							} else this._debug('processUpdateSetPreviewResults - no action - diag mode enabled');
						}	
					}
					// process all other errors
					else {
						// if UI action contains accept option
						// error is not ('newer version found', and not app scope collision, accept the error
						// "UI action - accept remote update"
						if ( gr1.available_actions.toString().contains("43d7d01a97b00100f309124eda2975e4")) { 
							//  preview problem action - accept remote is available
                            // https://community.servicenow.com/community?id=community_question&sys_id=de4007a1db98dbc01dcaf3231f9619e3
							this._debug('processUpdateSetPreviewResults - Accept error - '+gr1.missing_item+' '+gr1.description);
							if (!diag_mode){
                               var ppa = new GlidePreviewProblemAction(gs.action, gr1);
                               ppa.ignoreProblem(); // accept preview error
							} else this._debug('processUpdateSetPreviewResults - no action - diag mode enabled');
				      	}	
						
						// accept not available, attempt to skip update
						else if (gr1.available_actions.toString().contains("f6f5730c97410100d308124eda29758d")){
							//  UI Action uri=sys_ui_action.do?sys_id=f6f5730c97410100d308124eda29758d
							this._debug('processUpdateSetPreviewResults - Skip error  (Accept not available)- '+gr1.missing_item+' '+gr1.description);
							if (!diag_mode){
								var ppa = new GlidePreviewProblemAction(action, current);
								ppa.skipUpdate();
							} else this._debug('processUpdateSetPreviewResults - no action - diag mode enabled');
						}	
				
						
					}

                } // end - "is status null" check
            } // end loop
        } // end- param check

    },


    /**
      determine if an error that cannot be processed was found in the preview list
      @method foundCriticalErrorForUpdateSetPreview
      @param {string} update set name
      @return {boolean}
    */
    foundCriticalErrorForUpdateSetPreview: function(p_updateset_name) {
        var result = false;

        // todo

        // search sys_update_preview_problem for any preview errors that cannot be accepted
		// 1. nov 2022 - Cannot commit Update Set

		// suggestion: sept 2022 - make "found newer local version"  a critical error 

		 if (!gs.nil(p_updateset_name)) {
            // preview problems found in sys_update_preview_problem
            //status=^sys_created_onONToday@javascript:gs.beginningOfToday()@javascript:gs.endOfToday()
            var gr1 = new GlideRecord('sys_update_preview_problem');
            gr1.addEncodedQuery("type=error^status=^sys_created_onONLast 15 minutes@javascript:gs.beginningOfLast15Minutes()@javascript:gs.endOfLast15Minutes()");
            gr1.query();
            while (gr1.next()) {
                this._debug('foundCriticalErrorForUpdateSetPreview - CHECK - ' + gr1.type + ' ' + gr1.missing_item + ' ' + gr1.description, this.type);

				// process preview errors
                // UI action - Accept remote update
                if (gr1.status.nil() ){
					
					// critical error test 1 - app scope missing
					if (gr1.description.toString().includes('Cannot commit Update Set') || gr1.description.toString().includes('Resolve the problem before committing') ){
													
							this.debug('foundCriticalErrorForUpdateSetPreview - match - '+gr1.missing_item+' '+gr1.description);
							result = true;
					}
					
					// list more critical erorr here 
					
					
					// end critical error text check
					
                } // end - "is status null" check
            } // end while  loop
        } // end- param check
		
        return result;
    },

	
	

    /**
      start process to commit update sets to target instance 
	  taken from sys_script_include.do?sys_id=fcfc9e275bb01200abe48d5511f91aea
      @method startUpdateSetCommit
      @param {string} update set name
	  @return {string} progress workr sys_id
    */
    startUpdateSetCommit: function(p_updateset_name) {
        var result = '';
		
		var diag_mode = gs.getProperty('openapp.update_set.automation.commit_workflow.preview_error_processing.debug', 'false').toString().toLowerCase() == 'true';
		this._debug('startUpdateSetCommit - START - diag mode ='+diag_mode, this.type);
		
		
        if (!gs.nil(p_updateset_name)) {
            var usGR = this.getRetrievedUpdateSetGR(p_updateset_name);
            if (!gs.nil(usGR)) {
			
				if (!diag_mode){
					var commit_util = new SNC.HierarchyUpdateSetScriptable();
					this._debug('startUpdateSetCommit - start commit for update set: ' + usGR.name);
					result = commit_util.commitHierarchy(usGR.sys_id);
				} else this._debug('startUpdateSetCommit - aborted - diag mode is enabled');
            }
        }
        return result;

    },

    /**
       start the workflow for update set autocommit for a given update set name
       @method launchCommitWorkflowforUpdateSet
       @param {string} update set name
    */
    launchCommitWorkflowforUpdateSet: function(p_updateset_name) {
        var result = '';
		var wf = new Workflow();
        var wf_name = gs.getProperty('openapp.update_set.automation.commit_workflow_name'); // Update-set auto-deployment v1 
        var workflowId = wf.getWorkflowFromName(wf_name);
        this._debug("launchCommitWorkflowforUpdateSet  - Workflow id: " + workflowId + ', ' + wf_name+' - '+p_updateset_name);
		var context;
        
		// verify no other instances of this WF are running
		var gr1 = new GlideRecord('wf_context');
		gr1.addEncodedQuery('sys_created_onONToday@javascript:gs.beginningOfToday()@javascript:gs.endOfToday()^state=executing^nameSTARTSWITH'+wf_name);
		gr1.query();
		if (!gr1.hasNext()){
			// no executing WFs found, start new WF and return id
			context = wf.startFlow(workflowId, '', '', { 'u_update_set_name': p_updateset_name });
			result = context.getValue('sys_id').toString();
		}
				
		
		return result;
    },
	
	/**
	  get the glide record reference to the executing autodeployment workflow
	  @method getWorkflowExecContext 
	  @param {string}
	  @return {object}
	*/
	getWorkflowExecContext : function (p_wf_context_sysid){
		var result;
		if (!gs.nil(p_wf_context_sysid)){
			var gr1 = new GlideRecord('wf_context');
			if (gr1.get(p_wf_context_sysid)){
				result = gr1;
			}
		}
				
		return result;
		
	},
	
	/**
	  return the execution state of the worklfow context
	  @method getWorkflowContextState
	  @param {string} wf exec context sysid
	  @returns {string}
	*/
	getWorkflowContextState: function(p_wf_context_sysid){
		var result = '';
		if (!gs.nil(p_wf_context_sysid)){
			var wfGr = this.getWorkflowExecContext(p_wf_context_sysid);
			if (!gs.nil(wfGr)){
				result = wfGr.getValue('state').toString();
			}
		}
		return result;
	},
	
	

    type: 'UpdateSetCommitAutomationUtil'
};
