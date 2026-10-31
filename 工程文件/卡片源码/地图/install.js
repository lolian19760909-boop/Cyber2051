/* Assembled inside the existing chat-owned map startup scope. */
function install(window){
 const document=window.document,MutationObserver=window.MutationObserver,setTimeout=window.setTimeout.bind(window),clearTimeout=window.clearTimeout.bind(window);
 resourceClient||=CxxAtlasResourcesFactory.create({window,.../*MAP_RESOURCE_CONFIG*/});
 window.CXX_ATLAS_RESOURCES=resourceClient;
 window.TOKYO_ATLAS_DOCUMENTS=documents;
 window.CXX_MAP_DOCUMENT_PREPARE=prepare;
 /*MAP_SHELL_RUNTIME*/
}
