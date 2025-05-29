import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { AlertCircle, Clock, Copy, Edit, MoreVertical, Play, Trash2, Zap, Database, Tool, Settings, CheckCircle, XCircle, PauseCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Progress } from '../ui/progress';

// Types for the AgentCard component
export interface AgentCardProps {
  agent: {
    id: string | number;
    name: string;
    description: string;
    status: 'active' | 'inactive' | 'running' | 'error';
    tools: string[];
    sandboxId?: number;
    sandboxName?: string;
    lastRun?: Date;
    createdAt: Date;
    updatedAt: Date;
    tokenUsage?: {
      current: number;
      limit: number;
    };
    metadata?: Record<string, any>;
  };
  onEdit?: (agentId: string | number) => void;
  onRun?: (agentId: string | number) => void;
  onDelete?: (agentId: string | number) => void;
  onDuplicate?: (agentId: string | number) => void;
  onViewDetails?: (agentId: string | number) => void;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

/**
 * AgentCard Component
 * 
 * Displays agent information in a card format with actions and status indicators.
 */
export const AgentCard: React.FC<AgentCardProps> = ({
  agent,
  onEdit,
  onRun,
  onDelete,
  onDuplicate,
  onViewDetails,
  isLoading = false,
  error = null,
  className = ''
}) => {
  // Get status color and icon based on agent status
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
      case 'running':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'error':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    }
  };
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-3 w-3 mr-1" />;
      case 'inactive':
        return <PauseCircle className="h-3 w-3 mr-1" />;
      case 'running':
        return <Zap className="h-3 w-3 mr-1" />;
      case 'error':
        return <XCircle className="h-3 w-3 mr-1" />;
      default:
        return null;
    }
  };
  
  // Format date for display
  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };
  
  // Format time elapsed since last run
  const formatTimeElapsed = (date: Date): string => {
    const now = new Date();
    const elapsed = now.getTime() - new Date(date).getTime();
    
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };
  
  // Render loading state
  if (isLoading) {
    return (
      <Card className={`overflow-hidden ${className}`}>
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <div className="flex flex-wrap gap-1 mt-2">
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
              <Skeleton className="h-6 w-16" />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <div className="flex justify-between w-full">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </CardFooter>
      </Card>
    );
  }
  
  // Render error state
  if (error) {
    return (
      <Card className={`border-red-200 ${className}`}>
        <CardHeader className="pb-2">
          <CardTitle>Error Loading Agent</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card 
      className={`overflow-hidden transition-all duration-200 hover:shadow-md ${
        agent.status === 'running' ? 'border-blue-300 dark:border-blue-700' : ''
      } ${className}`}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-lg flex items-center">
              {agent.name}
              <Badge 
                variant="outline" 
                className={`ml-2 text-xs ${getStatusColor(agent.status)}`}
              >
                <span className="flex items-center">
                  {getStatusIcon(agent.status)}
                  {agent.status.charAt(0).toUpperCase() + agent.status.slice(1)}
                </span>
              </Badge>
            </CardTitle>
            <CardDescription className="line-clamp-1">
              {agent.description || 'No description provided'}
            </CardDescription>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onViewDetails?.(agent.id)}>
                <Settings className="mr-2 h-4 w-4" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit?.(agent.id)}>
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate?.(agent.id)}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => onDelete?.(agent.id)}
                className="text-red-600 dark:text-red-400"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-3">
          {/* Tools Section */}
          <div>
            <div className="text-sm font-medium mb-1 flex items-center">
              <Tool className="h-3 w-3 mr-1 text-muted-foreground" />
              <span>Tools</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {agent.tools.length === 0 ? (
                <span className="text-xs text-muted-foreground">No tools enabled</span>
              ) : (
                agent.tools.map((tool, index) => (
                  <Badge key={index} variant="secondary" className="text-xs">
                    {tool}
                  </Badge>
                ))
              )}
            </div>
          </div>
          
          {/* Sandbox Information */}
          {agent.sandboxId && (
            <div>
              <div className="text-sm font-medium mb-1 flex items-center">
                <Database className="h-3 w-3 mr-1 text-muted-foreground" />
                <span>Sandbox</span>
              </div>
              <div className="flex items-center">
                <Badge variant="outline" className="text-xs">
                  {agent.sandboxName || `Sandbox #${agent.sandboxId}`}
                </Badge>
                
                {agent.tokenUsage && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="ml-2 flex-1">
                          <Progress 
                            value={(agent.tokenUsage.current / agent.tokenUsage.limit) * 100} 
                            className="h-1" 
                          />
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="text-xs">
                          Token Usage: {agent.tokenUsage.current} / {agent.tokenUsage.limit}
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          )}
          
          {/* Last Run & Creation Date */}
          <div className="flex justify-between text-xs text-muted-foreground">
            <div className="flex items-center">
              <Clock className="h-3 w-3 mr-1" />
              {agent.lastRun ? (
                <span>Last run: {formatTimeElapsed(agent.lastRun)}</span>
              ) : (
                <span>Never run</span>
              )}
            </div>
            <div>
              Created: {formatDate(agent.createdAt)}
            </div>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="pt-2">
        <div className="flex justify-between w-full">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => onEdit?.(agent.id)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Edit
          </Button>
          
          <Button 
            size="sm" 
            onClick={() => onRun?.(agent.id)}
            disabled={agent.status === 'running'}
            className={agent.status === 'running' ? 'opacity-50 cursor-not-allowed' : ''}
          >
            {agent.status === 'running' ? (
              <>
                <Zap className="mr-2 h-4 w-4 animate-pulse" />
                Running...
              </>
            ) : (
              <>
                <Play className="mr-2 h-4 w-4" />
                Run
              </>
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};

export default AgentCard;
