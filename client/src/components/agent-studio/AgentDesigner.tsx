import React, { useState, useEffect } from 'react';
import { Card } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Checkbox } from '../ui/checkbox';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Skeleton } from '../ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';

// Types for the AgentDesigner component
export interface Tool {
  id: number;
  name: string;
  service: string;
  description: string;
  category: string;
  is_active: boolean;
}

export interface AgentConfig {
  name: string;
  description: string;
  prompt: string;
  tools: string[];
}

export interface AgentDesignerProps {
  agentConfig: AgentConfig;
  onAgentConfigChange: (config: AgentConfig) => void;
  availableTools?: Tool[];
  toolsLoading?: boolean;
  toolsError?: string | null;
  onFetchTools?: () => Promise<void>;
  className?: string;
  readOnly?: boolean;
}

/**
 * AgentDesigner Component
 * 
 * A visual interface for designing AI agents with configurable metadata and tools.
 */
export const AgentDesigner: React.FC<AgentDesignerProps> = ({
  agentConfig,
  onAgentConfigChange,
  availableTools = [],
  toolsLoading = false,
  toolsError = null,
  onFetchTools,
  className = '',
  readOnly = false
}) => {
  // Local validation state
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  
  // Validate the agent configuration
  useEffect(() => {
    const errors: Record<string, string> = {};
    
    if (!agentConfig.name.trim()) {
      errors.name = 'Agent name is required';
    }
    
    if (!agentConfig.prompt.trim()) {
      errors.prompt = 'System prompt is required';
    } else if (agentConfig.prompt.length < 10) {
      errors.prompt = 'System prompt is too short (minimum 10 characters)';
    }
    
    setValidationErrors(errors);
  }, [agentConfig]);
  
  // Handle input changes
  const handleInputChange = (field: keyof AgentConfig, value: string) => {
    if (readOnly) return;
    
    onAgentConfigChange({
      ...agentConfig,
      [field]: value
    });
  };
  
  // Handle tool selection toggle
  const handleToolToggle = (toolName: string, checked: boolean) => {
    if (readOnly) return;
    
    const updatedTools = checked
      ? [...agentConfig.tools, toolName]
      : agentConfig.tools.filter(t => t !== toolName);
    
    onAgentConfigChange({
      ...agentConfig,
      tools: updatedTools
    });
  };
  
  // Group tools by category
  const toolsByCategory = availableTools.reduce<Record<string, Tool[]>>((acc, tool) => {
    const category = tool.category || 'Other';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(tool);
    return acc;
  }, {});
  
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Agent Metadata Section */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Agent Configuration</h2>
        
        <div className="space-y-4">
          <div>
            <Label htmlFor="agentName" className={validationErrors.name ? 'text-destructive' : ''}>
              Agent Name
              {validationErrors.name && <span className="ml-2 text-xs">({validationErrors.name})</span>}
            </Label>
            <Input
              id="agentName"
              value={agentConfig.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter agent name"
              className={validationErrors.name ? 'border-destructive' : ''}
              disabled={readOnly}
            />
          </div>
          
          <div>
            <Label htmlFor="agentDescription">Description</Label>
            <Input
              id="agentDescription"
              value={agentConfig.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter agent description"
              disabled={readOnly}
            />
          </div>
          
          <div>
            <Label htmlFor="agentPrompt" className={validationErrors.prompt ? 'text-destructive' : ''}>
              System Prompt
              {validationErrors.prompt && <span className="ml-2 text-xs">({validationErrors.prompt})</span>}
            </Label>
            <Textarea
              id="agentPrompt"
              value={agentConfig.prompt}
              onChange={(e) => handleInputChange('prompt', e.target.value)}
              placeholder="Enter system prompt for the agent"
              className={`min-h-[150px] ${validationErrors.prompt ? 'border-destructive' : ''}`}
              disabled={readOnly}
            />
            <p className="text-xs text-muted-foreground mt-1">
              The system prompt defines the agent's personality, capabilities, and constraints.
            </p>
          </div>
        </div>
      </Card>
      
      {/* Tools Section */}
      <Card className="p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Tools</h2>
          
          {onFetchTools && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onFetchTools} 
              disabled={toolsLoading || readOnly}
            >
              {toolsLoading ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          )}
        </div>
        
        {toolsError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{toolsError}</AlertDescription>
          </Alert>
        )}
        
        {toolsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : (
          <div className="space-y-6">
            {availableTools.length === 0 ? (
              <p className="text-muted-foreground">No tools available</p>
            ) : (
              Object.entries(toolsByCategory).map(([category, tools]) => (
                <div key={category} className="space-y-3">
                  <h3 className="text-md font-semibold">{category}</h3>
                  <div className="space-y-4">
                    {tools.map((tool) => (
                      <div key={tool.id} className="flex items-start space-x-2">
                        <Checkbox
                          id={`tool-${tool.id}`}
                          checked={agentConfig.tools.includes(tool.name)}
                          onCheckedChange={(checked: boolean) => handleToolToggle(tool.name, checked === true)}
                          disabled={!tool.is_active || readOnly}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <Label
                            htmlFor={`tool-${tool.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            {tool.name}
                            <Badge variant="outline" className="ml-2">
                              {tool.service}
                            </Badge>
                            {!tool.is_active && (
                              <Badge variant="outline" className="ml-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
                                Inactive
                              </Badge>
                            )}
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            {tool.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        
        <div className="mt-4">
          <p className="text-sm text-muted-foreground">
            {agentConfig.tools.length === 0 ? (
              "No tools selected. The agent will have basic conversation capabilities only."
            ) : (
              `Selected tools (${agentConfig.tools.length}): ${agentConfig.tools.join(', ')}`
            )}
          </p>
        </div>
      </Card>
    </div>
  );
};

export default AgentDesigner;
