/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by stopping calls to failing services.
 * Implements the standard circuit breaker pattern with three states:
 * - Closed: Normal operation, requests pass through
 * - Open: Service is failing, requests are immediately rejected
 * - Half-Open: Testing if service has recovered, limited requests allowed
 */

import { logger } from "../utils/logger";

// Circuit breaker states
export type CircuitState = "closed" | "open" | "half-open";

// Configuration options
export interface CircuitBreakerOptions {
  name: string; // Name for identification in logs
  failureThreshold: number; // Number of failures before opening circuit
  resetTimeout: number; // Time in ms to wait before half-open state
  halfOpenSuccessThreshold?: number; // Successes needed to close circuit
  onOpen?: () => void; // Callback when circuit opens
  onClose?: () => void; // Callback when circuit closes
  onHalfOpen?: () => void; // Callback when circuit goes half-open
  trackHealthHistory?: boolean; // Whether to track health history
  healthHistorySize?: number; // Size of health history to maintain
}

// Health record for tracking service performance
interface HealthRecord {
  timestamp: number;
  success: boolean;
  duration: number;
  error?: string;
}

/**
 * Circuit Breaker implementation
 *
 * Protects systems from cascading failures by preventing repeated calls to failing services.
 */
export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private successCount: number = 0;
  private healthHistory: HealthRecord[] = [];
  private executionCount: number = 0;
  private successfulExecutions: number = 0;
  private failedExecutions: number = 0;

  // Configuration with defaults
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeout: number;
  private readonly halfOpenSuccessThreshold: number;
  private readonly trackHealthHistory: boolean;
  private readonly healthHistorySize: number;

  // Event callbacks
  private readonly onOpen?: () => void;
  private readonly onClose?: () => void;
  private readonly onHalfOpen?: () => void;

  /**
   * Creates a new CircuitBreaker
   */
  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold;
    this.resetTimeout = options.resetTimeout;
    this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold || 1;
    this.onOpen = options.onOpen;
    this.onClose = options.onClose;
    this.onHalfOpen = options.onHalfOpen;
    this.trackHealthHistory = options.trackHealthHistory || false;
    this.healthHistorySize = options.healthHistorySize || 100;

    logger.info(`Circuit breaker "${this.name}" initialized`, {
      failureThreshold: this.failureThreshold,
      resetTimeout: this.resetTimeout,
      halfOpenSuccessThreshold: this.halfOpenSuccessThreshold,
    });
  }

  /**
   * Executes a function with circuit breaker protection
   * @param fn The function to execute
   * @returns The result of the function
   * @throws Error if the circuit is open or the function fails
   */
  public async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.executionCount++;

    // Check if circuit is open
    if (this.state === "open") {
      // Check if reset timeout has elapsed
      if (Date.now() - this.lastFailureTime >= this.resetTimeout) {
        this.toHalfOpen();
      } else {
        this.failedExecutions++;
        throw new Error(`Circuit breaker "${this.name}" is open`);
      }
    }

    // Track execution start time
    const startTime = Date.now();

    try {
      // Execute the function
      const result = await fn();

      // Record success
      this.recordSuccess(startTime);
      return result;
    } catch (error) {
      // Record failure
      this.recordFailure(error, startTime);
      throw error;
    }
  }

  /**
   * Records a successful execution
   */
  private recordSuccess(startTime: number): void {
    const duration = Date.now() - startTime;
    this.successfulExecutions++;

    // Track health history if enabled
    if (this.trackHealthHistory) {
      this.addHealthRecord({
        timestamp: Date.now(),
        success: true,
        duration,
      });
    }

    // Handle success based on current state
    if (this.state === "half-open") {
      this.successCount++;

      logger.debug(
        `Circuit breaker "${this.name}" successful execution in half-open state`,
        {
          successCount: this.successCount,
          threshold: this.halfOpenSuccessThreshold,
        },
      );

      // If success threshold reached, close the circuit
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this.toClose();
      }
    } else if (this.state === "closed") {
      // Reset failure count on success in closed state
      this.failureCount = 0;
    }
  }

  /**
   * Records a failed execution
   */
  private recordFailure(error: any, startTime: number): void {
    const duration = Date.now() - startTime;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.failedExecutions++;

    // Track health history if enabled
    if (this.trackHealthHistory) {
      this.addHealthRecord({
        timestamp: Date.now(),
        success: false,
        duration,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    logger.debug(`Circuit breaker "${this.name}" failure recorded`, {
      failureCount: this.failureCount,
      threshold: this.failureThreshold,
      state: this.state,
      error: error instanceof Error ? error.message : String(error),
    });

    // If failure threshold reached, open the circuit
    if (this.state === "closed" && this.failureCount >= this.failureThreshold) {
      this.toOpen();
    } else if (this.state === "half-open") {
      // Any failure in half-open state opens the circuit
      this.toOpen();
    }
  }

  /**
   * Transitions the circuit to the open state
   */
  private toOpen(): void {
    if (this.state !== "open") {
      logger.warn(`Circuit breaker "${this.name}" opened`, {
        failureCount: this.failureCount,
        threshold: this.failureThreshold,
        resetTimeout: this.resetTimeout,
      });

      this.state = "open";
      this.successCount = 0;

      // Call onOpen callback if provided
      if (this.onOpen) {
        try {
          this.onOpen();
        } catch (error) {
          logger.error(
            `Error in onOpen callback for circuit breaker "${this.name}"`,
            {
              error: error instanceof Error ? error.message : String(error),
            },
          );
        }
      }
    }
  }

  /**
   * Transitions the circuit to the half-open state
   */
  private toHalfOpen(): void {
    if (this.state !== "half-open") {
      logger.info(`Circuit breaker "${this.name}" half-open`, {
        lastFailureTime: new Date(this.lastFailureTime).toISOString(),
        elapsedSinceFailure: Date.now() - this.lastFailureTime,
      });

      this.state = "half-open";
      this.successCount = 0;

      // Call onHalfOpen callback if provided
      if (this.onHalfOpen) {
        try {
          this.onHalfOpen();
        } catch (error) {
          logger.error(
            `Error in onHalfOpen callback for circuit breaker "${this.name}"`,
            {
              error: error instanceof Error ? error.message : String(error),
            },
          );
        }
      }
    }
  }

  /**
   * Transitions the circuit to the closed state
   */
  private toClose(): void {
    if (this.state !== "closed") {
      logger.info(`Circuit breaker "${this.name}" closed`, {
        successCount: this.successCount,
        threshold: this.halfOpenSuccessThreshold,
      });

      this.state = "closed";
      this.failureCount = 0;
      this.successCount = 0;

      // Call onClose callback if provided
      if (this.onClose) {
        try {
          this.onClose();
        } catch (error) {
          logger.error(
            `Error in onClose callback for circuit breaker "${this.name}"`,
            {
              error: error instanceof Error ? error.message : String(error),
            },
          );
        }
      }
    }
  }

  /**
   * Adds a health record to the history
   */
  private addHealthRecord(record: HealthRecord): void {
    this.healthHistory.push(record);

    // Trim history if it exceeds the maximum size
    if (this.healthHistory.length > this.healthHistorySize) {
      this.healthHistory.shift();
    }
  }

  /**
   * Forces the circuit to the closed state
   * Use with caution - typically for testing or manual intervention
   */
  public forceClose(): void {
    logger.warn(`Circuit breaker "${this.name}" force closed`);
    this.toClose();
  }

  /**
   * Forces the circuit to the open state
   * Use with caution - typically for testing or manual intervention
   */
  public forceOpen(): void {
    logger.warn(`Circuit breaker "${this.name}" force opened`);
    this.toOpen();
  }

  /**
   * Gets the current state of the circuit breaker
   */
  public getState(): CircuitState {
    return this.state;
  }

  /**
   * Gets statistics about the circuit breaker
   */
  public getStats(): {
    name: string;
    state: CircuitState;
    failureCount: number;
    successCount: number;
    lastFailureTime: number;
    executionCount: number;
    successRate: number;
    healthHistory?: HealthRecord[];
  } {
    const successRate =
      this.executionCount > 0
        ? (this.successfulExecutions / this.executionCount) * 100
        : 100;

    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      executionCount: this.executionCount,
      successRate,
      healthHistory: this.trackHealthHistory ? this.healthHistory : undefined,
    };
  }

  /**
   * Resets the circuit breaker to its initial state
   * Use with caution - typically for testing or manual intervention
   */
  public reset(): void {
    logger.warn(`Circuit breaker "${this.name}" reset to initial state`);
    this.state = "closed";
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = 0;
    this.healthHistory = [];
    this.executionCount = 0;
    this.successfulExecutions = 0;
    this.failedExecutions = 0;
  }
}
