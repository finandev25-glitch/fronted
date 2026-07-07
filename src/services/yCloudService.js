import { apiDelete, apiGet, apiPost, apiPut } from "./backendApi.js";

function buildDisabledResponse(message, extra = {}) {
  return {
    success: false,
    message,
    ...extra,
  };
}

async function tryBackendCall(path, body, method = "POST") {
  try {
    if (method === "GET") return await apiGet(path);
    if (method === "PUT") return await apiPut(path, body);
    if (method === "DELETE") return await apiDelete(path);
    return await apiPost(path, body);
  } catch (error) {
    return buildDisabledResponse(error.message, { error: error.message });
  }
}

const messagingService = {
  async listConfigs() {
    return [];
  },

  async listActiveConfigs() {
    return [];
  },

  async createConfig(configData) {
    return buildDisabledResponse("La administración de configuraciones fue retirada de esta versión.", {
      data: configData,
    });
  },

  async updateConfig(configId, configData) {
    return buildDisabledResponse("La administración de configuraciones fue retirada de esta versión.", {
      configId,
      data: configData,
    });
  },

  async deleteConfig(configId) {
    return buildDisabledResponse("La administración de configuraciones fue retirada de esta versión.", {
      configId,
    });
  },

  async testConnection(configId) {
    return buildDisabledResponse("La prueba de conexión legacy ya no está disponible.", {
      configId,
    });
  },

  async sendTextMessage(messageData) {
    return tryBackendCall("/messages/send", {
      ...messageData,
      type: "text",
      text: {
        body: messageData.text,
        previewUrl: messageData.previewUrl || false,
      },
    });
  },

  async sendTemplateMessage(messageData) {
    return tryBackendCall("/messages/send", {
      ...messageData,
      type: "template",
      template: {
        name: messageData.template?.name,
        language: messageData.template?.language || "es",
        components: messageData.template?.components || [],
      },
    });
  },

  async sendImageMessage(messageData) {
    return tryBackendCall("/messages/send", {
      ...messageData,
      type: "image",
      image: {
        link: messageData.imageUrl,
        caption: messageData.caption,
      },
    });
  },

  async sendDocumentMessage(messageData) {
    return tryBackendCall("/messages/send", {
      ...messageData,
      type: "document",
      document: {
        link: messageData.documentUrl,
        filename: messageData.filename,
        caption: messageData.caption,
      },
    });
  },

  async sendMessage(messageData) {
    return tryBackendCall("/messages/send", messageData);
  },

  async sendTestMessage(configId, toNumber) {
    return tryBackendCall("/messages/test", { configId, to: toNumber });
  },

  async getConversationHistory(params) {
    return tryBackendCall("/messages/conversation", params, "POST");
  },
};

export default messagingService;
