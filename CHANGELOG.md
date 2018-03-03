# Changelog

## [0.2.0] - 2018-03-04
- change: existing versions of generators are renamed, not overwritten
- removed: `hygen generate --force` option (has become unnecessary due to auto-rename of previous version)
- change: if HYGEN_CREATE_TMPLS is not set, will look for template directory using HYGEN_TMPLS, then in ./_templates
- add: option to specify whether generator will create a parent dir (`hygen-create setopt --gen-parent-dir|--no-parent-dir`)
- change: the created generator will not include a parent dir by default
- fix: HYGEN_CREATE_TMPLS can be relative

## [0.1.1] - 2018-02-28
- first version released to npm