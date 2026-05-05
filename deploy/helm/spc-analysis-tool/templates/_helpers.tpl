{{/* Common template helpers */}}
{{- define "spc.commonLabels" -}}
app.kubernetes.io/name: {{ include "spc.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "spc.labels" -}}
{{ include "spc.commonLabels" . }}
app.kubernetes.io/component: web
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

{{- define "spc.aiRuntimeApiUrl" -}}
{{- if .Values.gateway.enabled -}}
/
{{- else -}}
{{- default "" .Values.ai.apiUrl -}}
{{- end -}}
{{- end }}

{{- define "spc.aiRuntimeApiKey" -}}
{{- if .Values.gateway.enabled -}}
{{- default "e696c6b7ce2f111bc0b9cd731f3d314fc862ebe193b2cd29d01c3f396ac4a1f9" .Values.ai.apiKey -}}
{{- else -}}
{{- default "" .Values.ai.apiKey -}}
{{- end -}}
{{- end }}

{{- define "spc.aiRuntimeModel" -}}
{{- if .Values.gateway.enabled -}}
{{- default .Values.ai.model .Values.gateway.env.AI_MODEL -}}
{{- else -}}
{{- default "" .Values.ai.model -}}
{{- end -}}
{{- end }}

{{- define "spc.runtimeConfigJs" -}}
window.APP_CONFIG = {
	ENV: {{ default "default" .Values.config.runtimeEnv | quote }},
	FEATURES: {{ default (dict) .Values.config.features | toJson }},
	AI: {
		API_URL: {{ include "spc.aiRuntimeApiUrl" . | trim | quote }},
		API_KEY: {{ include "spc.aiRuntimeApiKey" . | trim | quote }},
		MODEL: {{ include "spc.aiRuntimeModel" . | trim | quote }},
	},
};
{{- end }}
