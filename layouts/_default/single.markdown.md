---
title: {{ .Title }}
date: {{ .Date.Format "2006-01-02" }}
{{- with .Params.tags }}
tags: {{ delimit . ", " }}
{{- end }}
{{- with .Params.categories }}
categories: {{ delimit . ", " }}
{{- end }}
---

{{ .RawContent }}
