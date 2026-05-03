{{/* Common template helpers */}}
{{- define "spc.commonLabels" -}}
app.kubernetes.io/name: {{ include "spc.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "spc.labels" -}}
{{ include "spc.commonLabels" . }}
app.kubernetes.io/component: frontend
{{- end }}

{{- define "spc.selectorLabels" -}}
app.kubernetes.io/name: {{ include "spc.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "spc.gatewayName" -}}
{{- printf "%s-gateway" (include "spc.name" .) | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{- define "spc.gatewayLabels" -}}
app.kubernetes.io/name: {{ include "spc.gatewayName" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/component: gateway
{{- end }}

{{- define "spc.gatewaySelectorLabels" -}}
app.kubernetes.io/name: {{ include "spc.gatewayName" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{- define "spc.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{- define "spc.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end }}

{{- define "spc.gatewayFullname" -}}
{{- printf "%s-gateway" (include "spc.fullname" .) | trunc 63 | trimSuffix "-" -}}
{{- end }}

{{- define "spc.gatewaySecretName" -}}
{{- default (printf "%s-secret-env" (include "spc.gatewayFullname" .)) .Values.gateway.externalSecret.target.name -}}
{{- end }}
