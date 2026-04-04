import type { TransitProgress, NavProgress } from '../state/types';
import { formatDistance, formatTime, minutesUntil, formatEta } from '../utils/time';

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 3) + '...';
}

export function formatTransitHeader(progress: TransitProgress): string {
  const step = progress.currentStep;
  const td = step.transitDetails;

  switch (progress.transitSubState) {
    case 'WALKING_TO_STOP':
      if (td) return `Walk to ${truncate(td.departureStop, 40)}`;
      return formatEta(progress.etaTimestamp, progress.etaMinutes);

    case 'WAITING':
      if (td) return `Waiting for ${td.lineShortName || td.lineName}`;
      return 'Waiting...';

    case 'ON_VEHICLE':
      if (td) return `On ${td.lineShortName || td.lineName} -> ${truncate(td.headsign, 30)}`;
      return 'On transit';

    case 'WALKING_FROM_STOP':
      return formatEta(progress.etaTimestamp, progress.etaMinutes);

    default:
      return formatEta(progress.etaTimestamp, progress.etaMinutes);
  }
}

export function formatTransitNav(progress: TransitProgress): string {
  const step = progress.currentStep;
  const td = step.transitDetails;

  switch (progress.transitSubState) {
    case 'WALKING_TO_STOP': {
      const instr = truncate(step.instruction, 80);
      const dist = formatDistance(progress.distanceToStepEnd);
      return `${instr}\n${dist}`;
    }

    case 'WAITING': {
      if (!td) return 'Waiting for vehicle...';
      const mins = minutesUntil(td.departureTime);
      const vehicle = td.vehicleType === 'BUS' ? 'Bus' :
                     td.vehicleType === 'SUBWAY' ? 'Metro' :
                     td.vehicleType === 'TRAM' ? 'Tram' : 'Train';
      return `${vehicle} ${td.lineShortName || td.lineName}\ntoward ${truncate(td.headsign, 40)}\n\nDeparts in ${mins} min\nat ${formatTime(td.departureTime)}`;
    }

    case 'ON_VEHICLE': {
      if (!td) return 'On transit...';
      const stops = progress.stopsRemaining ?? 0;
      const exitStop = truncate(td.arrivalStop, 40);

      if (progress.alertLevel === 'now') {
        return `GET OFF NOW\n${exitStop}`;
      }
      if (progress.alertLevel === 'imminent') {
        return `NEXT STOP: GET OFF\n${exitStop}`;
      }
      return `Get off at ${exitStop}\nin ${stops} stop${stops !== 1 ? 's' : ''}`;
    }

    case 'WALKING_FROM_STOP': {
      const instr = truncate(step.instruction, 80);
      const dist = formatDistance(progress.distanceToStepEnd);
      return `${instr}\n${dist}`;
    }

    default:
      return step.instruction;
  }
}

export function formatTransitFooter(progress: TransitProgress, totalSteps: number): string {
  const td = progress.currentStep.transitDetails;

  switch (progress.transitSubState) {
    case 'WALKING_TO_STOP':
      if (td) return `Board ${td.lineShortName || td.lineName} at ${formatTime(td.departureTime)}`;
      return `Step ${progress.currentStepIndex + 1}/${totalSteps}`;

    case 'WAITING':
      return `${progress.currentStepIndex + 1}/${totalSteps} | ${formatDistance(progress.totalRemainingDistance)} total`;

    case 'ON_VEHICLE':
      if (td) return `Arriving ${formatTime(td.arrivalTime)} | ${minutesUntil(td.arrivalTime)} min`;
      return `Step ${progress.currentStepIndex + 1}/${totalSteps}`;

    case 'WALKING_FROM_STOP':
      return `Step ${progress.currentStepIndex + 1}/${totalSteps} | ${formatDistance(progress.totalRemainingDistance)} to go`;

    default:
      return `${formatDistance(progress.totalRemainingDistance)} remaining`;
  }
}

/** Get the full-screen alert text for imminent/now alerts. */
export function getAlertText(progress: TransitProgress): string {
  const td = progress.currentStep.transitDetails;
  const stopName = td ? truncate(td.arrivalStop, 50) : 'your stop';

  if (progress.alertLevel === 'now') {
    return `GET OFF NOW\n\n${stopName}`;
  }
  if (progress.alertLevel === 'imminent') {
    return `NEXT STOP:\nGET OFF\n\n${stopName}`;
  }
  return '';
}

export function getAlertFooter(progress: TransitProgress): string {
  if (progress.alertLevel === 'now') return 'EXIT THE VEHICLE';
  if (progress.alertLevel === 'imminent') return 'PREPARE TO EXIT';
  return '';
}

/** Check if we should show a full-screen transit alert. */
export function shouldShowAlert(progress: NavProgress | TransitProgress): boolean {
  if (!('alertLevel' in progress)) return false;
  const tp = progress as TransitProgress;
  return tp.alertLevel === 'imminent' || tp.alertLevel === 'now';
}
