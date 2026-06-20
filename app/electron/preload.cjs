const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("trace", {
  runDemo: () => ipcRenderer.invoke("engine:runDemo")
});
