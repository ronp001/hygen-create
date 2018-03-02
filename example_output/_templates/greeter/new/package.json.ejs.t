---
to: package.json
---
{
  "name": "<%= name.toLowerCase() %>",
  "version": "1.0.0",
  "description": "an application that prints '<%= h.capitalize(name) %>!'",
  "scripts" : {
    "<%= name.toLowerCase() %>": "node dist/<%= name.toLowerCase() %>.js"
  }
}
