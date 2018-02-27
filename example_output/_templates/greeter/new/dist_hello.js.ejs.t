---
to: <%= name %>/dist/<%= name.toLowerCase() %>.js
---
// This is <%= name.toLowerCase() %>.js
console.log("<%= h.capitalize(name) %>!")