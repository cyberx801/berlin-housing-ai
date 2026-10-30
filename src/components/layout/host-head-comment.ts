/**
 * Netlify adds a line break and an HTML comment to the <head> of every page served from a
 * *.netlify.app address, right after <meta charset> (`<meta charset>\n<!-- ... -->`), and there is
 * no setting to turn it off. React 19 hydrates the whole document, can't match the extra text node
 * and comment, throws error #418 and renders every page again on the client.
 *
 * This runs in the head before hydration and removes that comment and the whitespace-only text nodes
 * next to it. Nothing else in <head> is touched, and without the comment it does nothing.
 */
export const hostHeadCommentScript = `(function(){try{var h=document.head,r=[];for(var n=h.firstChild;n;n=n.nextSibling){if(n.nodeType===8&&n.nodeValue.indexOf("hosted on Netlify")!==-1){r.push(n);[n.previousSibling,n.nextSibling].forEach(function(t){if(t&&t.nodeType===3&&!t.nodeValue.trim())r.push(t)})}}r.forEach(function(x){if(x.parentNode===h)h.removeChild(x)})}catch(e){}})();`;
