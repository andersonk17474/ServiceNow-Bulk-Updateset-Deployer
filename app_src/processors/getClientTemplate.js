(function process(g_request, g_response, g_processor) {
    var contents = '';
    /**
      use service now processor to load client templates
      @method process
    */
	var template_name = decodeURIComponent(g_request.getParameter('name'));

	if (gs.isLoggedIn() && JSUtil.notNil(template_name)){
  
            var gr = new GlideRecordSecure('u_client_templates');  
            if (gr.get('u_name', template_name)){  
                contents = gr.getValue('u_template');  
            }  
	
	}	

	g_processor.writeOutput('text/plain',contents);
  

})(g_request, g_response, g_processor);