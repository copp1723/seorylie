// Re-export handover service under legacy name
export { HandoverService, handoverService } from "./handover-service";
export type {
  HandoverData,
  HandoverOptions,
  HandoverReason,
  HandoverResult,
} from "./handover-service";
export default handoverService;
