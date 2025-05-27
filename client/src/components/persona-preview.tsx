import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface PersonaPreviewProps {
  persona: {
    name: string;
    tone: string;
    template?: string;
    welcomeMessage?: string;
  };
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl?: string;
}

export const PersonaPreview: React.FC<PersonaPreviewProps> = ({
  persona,
  primaryColor,
  secondaryColor,
  accentColor,
  logoUrl
}) => {
  // Generate sample messages based on persona tone
  const getSampleMessages = () => {
    const toneMap: {[key: string]: string[]} = {
      friendly: [
        "Hi there! I'm so glad you reached out. How can I help you today?",
        "That's a great question about our inventory! We have several options that might work for you."
      ],
      professional: [
        "Welcome. I'd be pleased to assist you with your automotive needs today.",
        "Regarding your inquiry about financing options, we offer several competitive programs."
      ],
      casual: [
        "Hey! Thanks for dropping by. What can I help you with?",
        "Cool question! Yeah, we've got a few models that match what you're looking for."
      ],
      formal: [
        "Good day. Thank you for contacting us. How may I be of assistance?",
        "In response to your inquiry, I would like to provide the following information."
      ]
    };
    
    return toneMap[persona.tone] || toneMap.friendly;
  };
  
  const sampleMessages = getSampleMessages();
  
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Persona Preview</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="border rounded-lg p-4">
          {/* Chat header */}
          <div 
            className="flex items-center gap-2 p-3 rounded-t-lg" 
            style={{ backgroundColor: primaryColor, color: '#fff' }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="Dealership logo" className="h-8 w-8" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-white flex items-center justify-center">
                <span style={{ color: primaryColor }}>D</span>
              </div>
            )}
            <div>
              <div className="font-medium">Chat with {persona.name}</div>
              <div className="text-xs opacity-90">Automotive Assistant</div>
            </div>
          </div>
          
          {/* Welcome message */}
          <div className="p-4 border-b">
            <div className="flex gap-3">
              <Avatar>
                <AvatarImage src={logoUrl} />
                <AvatarFallback style={{ backgroundColor: primaryColor, color: '#fff' }}>
                  {persona.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-medium">{persona.name}</div>
                <div className="mt-1 p-3 rounded-lg" style={{ backgroundColor: secondaryColor }}>
                  {persona.welcomeMessage || `Welcome! I'm ${persona.name}, your automotive assistant. How can I help you today?`}
                </div>
              </div>
            </div>
          </div>
          
          {/* Sample conversation */}
          <div className="p-4">
            {/* User message */}
            <div className="flex justify-end mb-4">
              <div className="max-w-[80%]">
                <div className="font-medium text-right">You</div>
                <div className="mt-1 p-3 rounded-lg" style={{ backgroundColor: '#f0f0f0' }}>
                  I'm looking for information about your SUV models.
                </div>
              </div>
            </div>
            
            {/* Persona response */}
            <div className="flex gap-3">
              <Avatar>
                <AvatarImage src={logoUrl} />
                <AvatarFallback style={{ backgroundColor: primaryColor, color: '#fff' }}>
                  {persona.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-medium">{persona.name}</div>
                <div className="mt-1 p-3 rounded-lg" style={{ backgroundColor: secondaryColor }}>
                  {sampleMessages[0]}
                </div>
              </div>
            </div>
            
            {/* User message */}
            <div className="flex justify-end my-4">
              <div className="max-w-[80%]">
                <div className="font-medium text-right">You</div>
                <div className="mt-1 p-3 rounded-lg" style={{ backgroundColor: '#f0f0f0' }}>
                  Do you have any with good gas mileage?
                </div>
              </div>
            </div>
            
            {/* Persona response */}
            <div className="flex gap-3">
              <Avatar>
                <AvatarImage src={logoUrl} />
                <AvatarFallback style={{ backgroundColor: primaryColor, color: '#fff' }}>
                  {persona.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="font-medium">{persona.name}</div>
                <div className="mt-1 p-3 rounded-lg" style={{ backgroundColor: secondaryColor }}>
                  {sampleMessages[1]}
                </div>
              </div>
            </div>
          </div>
          
          {/* Chat input */}
          <div className="p-3 border-t">
            <div className="flex gap-2">
              <div className="flex-1 p-2 border rounded-lg bg-white">
                Type your message...
              </div>
              <button 
                className="px-3 py-2 rounded-lg text-white flex items-center justify-center"
                style={{ backgroundColor: accentColor }}
              >
                Send
              </button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};