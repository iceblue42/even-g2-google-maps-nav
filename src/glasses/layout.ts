// Even G2 display: 576x288px, 4-bit greyscale (16 green levels)
// Max containers: 4 image + 8 text, exactly 1 must have isEventCapture=1

export const DISPLAY_WIDTH = 576;
export const DISPLAY_HEIGHT = 288;

export const MAP_WIDTH = 288;
export const MAP_HEIGHT = 144;

// Container IDs and names (must match exactly between create and update calls)
export const HEADER_ID = 1;
export const HEADER_NAME = 'header-txt';

export const MAP_ID = 2;
export const MAP_NAME = 'map-img';

export const NAV_ID = 3;
export const NAV_NAME = 'nav-txt';

export const ENV_ID = 4;
export const ENV_NAME = 'env-txt';

export const FOOTER_ID = 5;
export const FOOTER_NAME = 'footer-txt';

export function getDefaultContainerConfig(
  headerText: string,
  navText: string,
  envText: string,
  footerText: string
) {
  return {
    containerTotalNum: 6,
    textObject: [
      {
        containerID: HEADER_ID,
        containerName: HEADER_NAME,
        xPosition: 4,
        yPosition: 0,
        width: 568,
        height: 30,
        content: headerText,
        paddingLength: 2,
        borderWidth: 0,
        borderColor: 0,
        borderRadius: 0,
        isEventCapture: 0,
      },
      {
        containerID: NAV_ID,
        containerName: NAV_NAME,
        xPosition: 4,
        yPosition: 34,
        width: 270,
        height: 110,
        content: navText,
        paddingLength: 4,
        borderWidth: 1,
        borderColor: 4,
        borderRadius: 4,
        isEventCapture: 1,
      },
      {
        containerID: ENV_ID,
        containerName: ENV_NAME,
        xPosition: 4,
        yPosition: 148,
        width: 270,
        height: 136,
        content: envText,
        paddingLength: 4,
        borderWidth: 1,
        borderColor: 2,
        borderRadius: 4,
        isEventCapture: 0,
      },
      {
        containerID: FOOTER_ID,
        containerName: FOOTER_NAME,
        xPosition: 278,
        yPosition: 180,
        width: 288,
        height: 104,
        content: footerText,
        paddingLength: 4,
        borderWidth: 1,
        borderColor: 2,
        borderRadius: 4,
        isEventCapture: 0,
      },
    ],
    imageObject: [
      {
        containerID: MAP_ID,
        containerName: MAP_NAME,
        xPosition: 278,
        yPosition: 34,
        width: MAP_WIDTH,
        height: MAP_HEIGHT,
      },
    ],
  };
}

/** Alert layout: full-width text for transit "GET OFF" alerts, no map. */
export function getAlertContainerConfig(alertText: string, footerText: string) {
  return {
    containerTotalNum: 2,
    textObject: [
      {
        containerID: 1,
        containerName: 'alert-txt',
        xPosition: 4,
        yPosition: 4,
        width: 568,
        height: 248,
        content: alertText,
        paddingLength: 8,
        borderWidth: 2,
        borderColor: 15, // brightest
        borderRadius: 6,
        isEventCapture: 1,


      },
      {
        containerID: 2,
        containerName: 'alert-footer',
        xPosition: 4,
        yPosition: 258,
        width: 568,
        height: 28,
        content: footerText,
        paddingLength: 2,
        borderWidth: 0,
        borderColor: 0,
        borderRadius: 0,
        isEventCapture: 0,


      },
    ],
    imageObject: [],
  };
}

/** Overview layout: 4 text containers, no map. */
export function getOverviewContainerConfig(
  headerText: string,
  stepsText: string,
  footerText: string
) {
  return {
    containerTotalNum: 3,
    textObject: [
      {
        containerID: HEADER_ID,
        containerName: HEADER_NAME,
        xPosition: 4,
        yPosition: 0,
        width: 568,
        height: 30,
        content: headerText,
        paddingLength: 2,
        borderWidth: 0,
        borderColor: 0,
        borderRadius: 0,
        isEventCapture: 0,


      },
      {
        containerID: NAV_ID,
        containerName: NAV_NAME,
        xPosition: 4,
        yPosition: 34,
        width: 568,
        height: 220,
        content: stepsText,
        paddingLength: 4,
        borderWidth: 1,
        borderColor: 4,
        borderRadius: 4,
        isEventCapture: 1,


      },
      {
        containerID: FOOTER_ID,
        containerName: FOOTER_NAME,
        xPosition: 4,
        yPosition: 258,
        width: 568,
        height: 28,
        content: footerText,
        paddingLength: 2,
        borderWidth: 0,
        borderColor: 0,
        borderRadius: 0,
        isEventCapture: 0,


      },
    ],
    imageObject: [],
  };
}

/** Environment layout: 3 text containers showing weather, AQI, pollen. */
export function getEnvironmentContainerConfig(
  headerText: string,
  envText: string,
  footerText: string
) {
  return {
    containerTotalNum: 3,
    textObject: [
      {
        containerID: HEADER_ID,
        containerName: HEADER_NAME,
        xPosition: 4,
        yPosition: 0,
        width: 568,
        height: 30,
        content: headerText,
        paddingLength: 2,
        borderWidth: 0,
        borderColor: 0,
        borderRadius: 0,
        isEventCapture: 0,


      },
      {
        containerID: NAV_ID,
        containerName: NAV_NAME,
        xPosition: 4,
        yPosition: 34,
        width: 568,
        height: 220,
        content: envText,
        paddingLength: 6,
        borderWidth: 1,
        borderColor: 4,
        borderRadius: 4,
        isEventCapture: 1,


      },
      {
        containerID: FOOTER_ID,
        containerName: FOOTER_NAME,
        xPosition: 4,
        yPosition: 258,
        width: 568,
        height: 28,
        content: footerText,
        paddingLength: 2,
        borderWidth: 0,
        borderColor: 0,
        borderRadius: 0,
        isEventCapture: 0,


      },
    ],
    imageObject: [],
  };
}

/** Map-only layout: larger map + small ETA text. */
export function getMapOnlyContainerConfig(etaText: string) {
  return {
    containerTotalNum: 2,
    textObject: [
      {
        containerID: HEADER_ID,
        containerName: HEADER_NAME,
        xPosition: 4,
        yPosition: 0,
        width: 568,
        height: 28,
        content: etaText,
        paddingLength: 2,
        borderWidth: 0,
        borderColor: 0,
        borderRadius: 0,
        isEventCapture: 1,


      },
    ],
    imageObject: [
      {
        containerID: MAP_ID,
        containerName: MAP_NAME,
        xPosition: 4,
        yPosition: 32,
        width: 280,
        height: 140,
      },
    ],
  };
}
