---
to: <%= name %>/package.json
---
{
  "name": "<%= name %>",
  "version": "1.0.0",
  "description": "an application that prints '<%= h.capitalize(name) %>!'",
  "scripts" : {
    "<%= name %>": "node dist/<%= name %>.js"
  }
}
