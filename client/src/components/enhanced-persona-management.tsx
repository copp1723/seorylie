import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Switch } from './ui/switch';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Alert, AlertDescription } from './ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { 
  Save, 
  Edit, 
  Eye, 
  Copy, 
  Plus, 
  Trash2, 
  Settings, 
  MessageSquare, 
  RefreshCw,
  CheckCircle,
  AlertCircle,
  History,
  Download,
  Upload
} from 'lucide-react';
import { format } from 'date-fns';

interface Persona {
  id: number;
  name: string;
  isDefault: boolean;
  promptTemplate: string;
  arguments: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

interface PersonaPreviewResult {
  success: boolean;
  persona: Persona;
  processedPrompt: string;
  testMessage: string;
  aiResponse: string;
  includeInventory: boolean;
  timestamp: string;
}

export function EnhancedPersonaManagement() {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [editingPersona, setEditingPersona] = useState<Persona | null>(null);
  const [previewResult, setPreviewResult] = useState<PersonaPreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  
  // Form states
  const [personaForm, setPersonaForm] = useState({
    name: '',
    promptTemplate: '',
    arguments: {} as Record<string, any>,
    isDefault: false
  });
  
  // Preview form states
  const [previewForm, setPreviewForm] = useState({
    testMessage: "Hello, I'm interested in learning more about your vehicles.",
    includeInventory: true
  });

  // Mock dealership ID - in real app this would come from user context
  const dealershipId = 1;

  const fetchPersonas = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/prompt-testing/personas?dealershipId=${dealershipId}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setPersonas(data.personas);
      } else {
        console.error('Failed to fetch personas');
      }
    } catch (error) {
      console.error('Error fetching personas:', error);
    } finally {
      setLoading(false);
    }
  };

  const savePersona = async () => {
    setSaveLoading(true);
    try {
      const url = editingPersona 
        ? `/api/personas/${editingPersona.id}`
        : '/api/personas';
      
      const method = editingPersona ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...personaForm,
          dealershipId
        })
      });

      if (response.ok) {
        await fetchPersonas();
        setEditingPersona(null);
        setPersonaForm({
          name: '',
          promptTemplate: '',
          arguments: {},
          isDefault: false
        });
      }
    } catch (error) {
      console.error('Error saving persona:', error);
    } finally {
      setSaveLoading(false);
    }
  };

  const previewPersona = async (persona: Persona) => {
    setPreviewLoading(true);
    try {
      const response = await fetch('/api/prompt-testing/preview-persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          personaId: persona.id,
          testMessage: previewForm.testMessage,
          dealershipId: previewForm.includeInventory ? dealershipId : undefined,
          includeInventory: previewForm.includeInventory
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPreviewResult(data);
      }
    } catch (error) {
      console.error('Error previewing persona:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const duplicatePersona = (persona: Persona) => {
    setPersonaForm({
      name: `${persona.name} (Copy)`,
      promptTemplate: persona.promptTemplate,
      arguments: { ...persona.arguments },
      isDefault: false
    });
    setEditingPersona(null);
  };

  const editPersona = (persona: Persona) => {
    setPersonaForm({
      name: persona.name,
      promptTemplate: persona.promptTemplate,
      arguments: { ...persona.arguments },
      isDefault: persona.isDefault
    });
    setEditingPersona(persona);
  };

  const addPersonaArgument = () => {
    const key = prompt('Enter argument key:');
    if (key && key.trim()) {
      setPersonaForm(prev => ({
        ...prev,
        arguments: {
          ...prev.arguments,
          [key.trim()]: ''
        }
      }));
    }
  };

  const updatePersonaArgument = (key: string, value: any) => {
    setPersonaForm(prev => ({
      ...prev,
      arguments: {
        ...prev.arguments,
        [key]: value
      }
    }));
  };

  const removePersonaArgument = (key: string) => {
    setPersonaForm(prev => {
      const newArgs = { ...prev.arguments };
      delete newArgs[key];
      return {
        ...prev,
        arguments: newArgs
      };
    });
  };

  useEffect(() => {
    fetchPersonas();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Persona Management</h1>
          <p className="text-muted-foreground">
            Create and manage AI personas with custom prompts and behaviors
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              setEditingPersona(null);
              setPersonaForm({
                name: '',
                promptTemplate: '',
                arguments: {},
                isDefault: false
              });
            }}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Persona
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Persona List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Personas</CardTitle>
              <CardDescription>
                Existing personas for this dealership
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading personas...</div>
              ) : (
                <div className="space-y-3">
                  {personas.map((persona) => (
                    <div
                      key={persona.id}
                      className="p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-medium">{persona.name}</h3>
                            {persona.isDefault && (
                              <Badge variant="default">Default</Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                            {persona.promptTemplate.substring(0, 150)}...
                          </p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>Created: {format(new Date(persona.createdAt), 'MMM d, yyyy')}</span>
                            <span>•</span>
                            <span>Updated: {format(new Date(persona.updatedAt), 'MMM d, yyyy')}</span>
                            {Object.keys(persona.arguments).length > 0 && (
                              <>
                                <span>•</span>
                                <span>{Object.keys(persona.arguments).length} arguments</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 ml-4">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setSelectedPersona(persona)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                              <DialogHeader>
                                <DialogTitle>Preview: {persona.name}</DialogTitle>
                                <DialogDescription>
                                  Test this persona with different scenarios
                                </DialogDescription>
                              </DialogHeader>
                              
                              <Tabs defaultValue="preview" className="w-full">
                                <TabsList>
                                  <TabsTrigger value="preview">Preview</TabsTrigger>
                                  <TabsTrigger value="template">Template</TabsTrigger>
                                  <TabsTrigger value="arguments">Arguments</TabsTrigger>
                                </TabsList>
                                
                                <TabsContent value="preview" className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div>
                                      <Label htmlFor="testMessage">Test Message</Label>
                                      <Textarea
                                        id="testMessage"
                                        value={previewForm.testMessage}
                                        onChange={(e) => setPreviewForm(prev => ({
                                          ...prev,
                                          testMessage: e.target.value
                                        }))}
                                        rows={3}
                                      />
                                    </div>
                                    <div className="space-y-4">
                                      <div className="flex items-center space-x-2">
                                        <Switch
                                          id="includeInventory"
                                          checked={previewForm.includeInventory}
                                          onCheckedChange={(checked) => setPreviewForm(prev => ({
                                            ...prev,
                                            includeInventory: checked
                                          }))}
                                        />
                                        <Label htmlFor="includeInventory">Include Inventory Context</Label>
                                      </div>
                                      <Button
                                        onClick={() => previewPersona(persona)}
                                        disabled={previewLoading}
                                        className="w-full"
                                      >
                                        {previewLoading ? (
                                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                          <MessageSquare className="h-4 w-4 mr-2" />
                                        )}
                                        Test Preview
                                      </Button>
                                    </div>
                                  </div>
                                  
                                  {previewResult && (
                                    <div className="space-y-4 mt-6">
                                      <Alert>
                                        <CheckCircle className="h-4 w-4" />
                                        <AlertDescription>
                                          Preview generated successfully at {format(new Date(previewResult.timestamp), 'HH:mm:ss')}
                                        </AlertDescription>
                                      </Alert>
                                      
                                      <div className="grid grid-cols-2 gap-4">
                                        <div>
                                          <Label className="text-sm font-medium">Customer Message</Label>
                                          <div className="p-3 bg-blue-50 border-l-4 border-blue-500 rounded">
                                            {previewResult.testMessage}
                                          </div>
                                        </div>
                                        <div>
                                          <Label className="text-sm font-medium">AI Response</Label>
                                          <div className="p-3 bg-gray-50 border-l-4 border-gray-500 rounded">
                                            {previewResult.aiResponse}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      <details className="border rounded p-4">
                                        <summary className="font-medium cursor-pointer">Processed Prompt</summary>
                                        <pre className="mt-2 text-xs bg-gray-100 p-2 rounded overflow-x-auto">
                                          {previewResult.processedPrompt}
                                        </pre>
                                      </details>
                                    </div>
                                  )}
                                </TabsContent>
                                
                                <TabsContent value="template">
                                  <div className="space-y-2">
                                    <Label>Prompt Template</Label>
                                    <Textarea
                                      value={persona.promptTemplate}
                                      readOnly
                                      rows={15}
                                      className="font-mono text-sm"
                                    />
                                  </div>
                                </TabsContent>
                                
                                <TabsContent value="arguments">
                                  {Object.keys(persona.arguments).length > 0 ? (
                                    <Table>
                                      <TableHeader>
                                        <TableRow>
                                          <TableHead>Key</TableHead>
                                          <TableHead>Value</TableHead>
                                          <TableHead>Type</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {Object.entries(persona.arguments).map(([key, value]) => (
                                          <TableRow key={key}>
                                            <TableCell className="font-mono">{key}</TableCell>
                                            <TableCell className="max-w-[200px] truncate">
                                              {typeof value === 'string' ? value : JSON.stringify(value)}
                                            </TableCell>
                                            <TableCell>{typeof value}</TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  ) : (
                                    <div className="text-center py-8 text-muted-foreground">
                                      No arguments defined for this persona
                                    </div>
                                  )}
                                </TabsContent>
                              </Tabs>
                            </DialogContent>
                          </Dialog>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => editPersona(persona)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => duplicatePersona(persona)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {personas.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No personas found. Create your first persona to get started.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Persona Editor */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>
                {editingPersona ? 'Edit Persona' : 'Create Persona'}
              </CardTitle>
              <CardDescription>
                Configure persona details and behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="personaName">Name</Label>
                <Input
                  id="personaName"
                  value={personaForm.name}
                  onChange={(e) => setPersonaForm(prev => ({
                    ...prev,
                    name: e.target.value
                  }))}
                  placeholder="Enter persona name"
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isDefault"
                  checked={personaForm.isDefault}
                  onCheckedChange={(checked) => setPersonaForm(prev => ({
                    ...prev,
                    isDefault: checked
                  }))}
                />
                <Label htmlFor="isDefault">Set as default persona</Label>
              </div>

              <div>
                <Label htmlFor="promptTemplate">Prompt Template</Label>
                <Textarea
                  id="promptTemplate"
                  value={personaForm.promptTemplate}
                  onChange={(e) => setPersonaForm(prev => ({
                    ...prev,
                    promptTemplate: e.target.value
                  }))}
                  placeholder="Enter system prompt template..."
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use {`{{variable_name}}`} for template variables
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Arguments</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addPersonaArgument}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                
                <div className="space-y-2">
                  {Object.entries(personaForm.arguments).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <Input
                        value={key}
                        readOnly
                        className="w-32 font-mono text-sm"
                      />
                      <Input
                        value={typeof value === 'string' ? value : JSON.stringify(value)}
                        onChange={(e) => updatePersonaArgument(key, e.target.value)}
                        placeholder="Value"
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removePersonaArgument(key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  {Object.keys(personaForm.arguments).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No arguments defined
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={savePersona}
                  disabled={saveLoading || !personaForm.name.trim() || !personaForm.promptTemplate.trim()}
                  className="flex-1"
                >
                  {saveLoading ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  {editingPersona ? 'Update' : 'Create'}
                </Button>
                
                {editingPersona && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingPersona(null);
                      setPersonaForm({
                        name: '',
                        promptTemplate: '',
                        arguments: {},
                        isDefault: false
                      });
                    }}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}