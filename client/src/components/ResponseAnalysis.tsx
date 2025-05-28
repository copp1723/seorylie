import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Copy, FileText } from "lucide-react";

interface ResponseAnalysisProps {
  analysis?: {
    customerName: string;
    query: string;
    analysis: string;
    insights: string;
    channel: string;
    salesReadiness: "low" | "medium" | "high";
    handoverNeeded: boolean;
  };
  handoverDossier?: {
    customerName: string;
    customerContact: string;
    conversationSummary: string;
    customerInsights?: Array<{
      key: string;
      value: string;
      confidence: number;
    }>;
    vehicleInterests?: Array<{
      make: string;
      model: string;
      year: number;
      confidence: number;
    }>;
    suggestedApproach: string;
    urgency: "low" | "medium" | "high";
    escalationReason: string;
  };
  onGenerateHandover?: () => void;
  isGeneratingHandover?: boolean;
  showJson?: boolean;
  onToggleJson?: () => void;
}

export function ResponseAnalysis({ 
  analysis, 
  handoverDossier, 
  onGenerateHandover, 
  isGeneratingHandover = false,
  showJson = false,
  onToggleJson 
}: ResponseAnalysisProps) {
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="space-y-4">
      {/* Response Analysis Section */}
      {analysis && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Response Analysis
            </CardTitle>
            <CardDescription>
              AI-generated analysis of the customer interaction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-50 p-4 rounded-md border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <span className="font-semibold text-sm block text-gray-700">Customer Name:</span>
                    <span className="text-sm">{analysis.customerName}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-sm block text-gray-700">Analysis:</span>
                    <span className="text-sm text-gray-600">{analysis.analysis}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-sm block text-gray-700">Insights:</span>
                    <span className="text-sm text-gray-600">{analysis.insights}</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="font-semibold text-sm block text-gray-700">Query:</span>
                    <span className="text-sm text-gray-600">{analysis.query}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-sm block text-gray-700">Channel:</span>
                    <span className="text-sm">{analysis.channel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-700">Sales Readiness:</span>
                    <Badge 
                      variant={
                        analysis.salesReadiness === "high" ? "default" :
                        analysis.salesReadiness === "medium" ? "secondary" : "outline"
                      }
                      className="text-xs"
                    >
                      {analysis.salesReadiness}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-gray-700">Handover Needed:</span>
                    <Badge 
                      variant={analysis.handoverNeeded ? "destructive" : "outline"} 
                      className="text-xs"
                    >
                      {analysis.handoverNeeded ? "Yes" : "No"}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Generate Handover Button */}
      {analysis && !handoverDossier && onGenerateHandover && (
        <div className="flex justify-center">
          <Button
            onClick={onGenerateHandover}
            disabled={isGeneratingHandover}
            className="w-full max-w-md"
          >
            {isGeneratingHandover ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-white" />
                Generating Handover...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-4 w-4" />
                Generate Handover Dossier
              </>
            )}
          </Button>
        </div>
      )}

      {/* Handover Dossier Section */}
      {handoverDossier && !showJson && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Handover Dossier
            </CardTitle>
            <CardDescription>
              Comprehensive sales lead summary for handover to human agents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-amber-50 p-4 rounded-md border border-amber-200">
              <div className="space-y-4">
                {/* Customer Information */}
                <div>
                  <h4 className="font-semibold text-amber-900 mb-2">Customer Information</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <p><span className="font-medium">Name:</span> {handoverDossier.customerName}</p>
                    <p><span className="font-medium">Contact:</span> {handoverDossier.customerContact}</p>
                  </div>
                </div>

                <Separator />

                {/* Conversation Summary */}
                <div>
                  <h4 className="font-semibold text-amber-900 mb-2">Conversation Summary</h4>
                  <p className="text-sm text-gray-700">{handoverDossier.conversationSummary}</p>
                </div>

                <Separator />

                {/* Customer Insights */}
                {handoverDossier.customerInsights && handoverDossier.customerInsights.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-amber-900 mb-2">Customer Insights</h4>
                    <ul className="space-y-1">
                      {handoverDossier.customerInsights.map((insight, i) => (
                        <li key={i} className="text-sm">
                          <span className="font-medium">{insight.key}:</span> {insight.value}
                          <span className="text-xs text-gray-500 ml-2">
                            ({Math.round(insight.confidence * 100)}% confidence)
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Vehicle Interests */}
                {handoverDossier.vehicleInterests && handoverDossier.vehicleInterests.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-semibold text-amber-900 mb-2">Vehicle Interests</h4>
                      <ul className="space-y-1">
                        {handoverDossier.vehicleInterests.map((vehicle, i) => (
                          <li key={i} className="text-sm">
                            <span className="font-medium">
                              {vehicle.year} {vehicle.make} {vehicle.model}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">
                              ({Math.round(vehicle.confidence * 100)}% confidence)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                <Separator />

                {/* Action Items */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-amber-900 mb-2">Suggested Approach</h4>
                    <p className="text-sm text-gray-700">{handoverDossier.suggestedApproach}</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-amber-900">Urgency:</span>
                      <Badge 
                        variant={
                          handoverDossier.urgency === "high" ? "destructive" :
                          handoverDossier.urgency === "medium" ? "default" : "secondary"
                        }
                        className="text-xs"
                      >
                        {handoverDossier.urgency}
                      </Badge>
                    </div>
                    <div>
                      <span className="font-semibold text-amber-900 text-sm block">Escalation Reason:</span>
                      <span className="text-sm text-gray-700">{handoverDossier.escalationReason}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* JSON View Toggle */}
      {(analysis || handoverDossier) && onToggleJson && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onToggleJson}
          >
            {showJson ? "Hide JSON" : "Show JSON"}
          </Button>
          {(analysis || handoverDossier) && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(JSON.stringify(handoverDossier || analysis, null, 2))}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy JSON
            </Button>
          )}
        </div>
      )}
    </div>
  );
}