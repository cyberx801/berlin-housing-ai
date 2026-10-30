/**
 * Netlify adds an HTML comment and a line break to the <head> of every page served from a
 * *.netlify.app address (after <meta charset>), and there is no setting to turn it off. React 19
 * hydrates the whole document, can't match the extra comment and text node, throws error #418 and
 * renders every page again on the client.
 *
 * This runs in the head before hydration and removes exactly that comment and the whitespace-only
 * text node right after it. Nothing else in <head> is touched, and without the comment it does nothing.
 */
export const hostHeadCommentScript = `(function(){try{var h=document.head,r=[];for(var n=h.firstChild;n;n=n.nextSibling){if(n.nodeType===8&&n.nodeValue.indexOf("hosted on Netlify")!==-1){r.push(n);var t=n.nextSibling;if(t&&t.nodeType===3&&!t.nodeValue.trim())r.push(t)}}r.forEach(function(x){h.removeChild(x)})}catch(e){}})();`;
