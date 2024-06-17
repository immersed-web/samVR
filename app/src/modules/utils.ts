
export function getAssetUrl(generatedName?: string) {
  console.log('getFileUrl called', generatedName);
  if (generatedName === undefined) {
    return undefined
  }

  return `https://${import.meta.env.EXPOSED_SERVER_URL}${import.meta.env.EXPOSED_FILESERVER_PATH}/file/${generatedName}`;
  // return `https://${process.env.EXPOSED_SERVER_URL}${process.env.EXPOSED_FILESERVER_PATH}/files/${generatedName}`;
}