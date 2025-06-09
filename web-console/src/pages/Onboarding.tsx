import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { CheckCircle, ArrowRight, Building, Globe, Target } from "lucide-react";

export default function Onboarding() {
  const steps = [
    {
      title: "Business Information",
      description: "Tell us about your company and website",
      icon: Building,
      completed: true
    },
    {
      title: "Website Analysis",
      description: "We'll analyze your current SEO performance",
      icon: Globe,
      completed: true
    },
    {
      title: "Goals & Objectives",
      description: "Define your SEO goals and target metrics",
      icon: Target,
      completed: false,
      active: true
    }
  ];

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Welcome to Your SEO Journey</h1>
        <p className="text-muted-foreground mt-2">
          Let's get your account set up and start optimizing your website
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center space-x-8">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={index} className="flex items-center space-x-4">
              <div className="flex flex-col items-center space-y-2">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  step.completed ? 'bg-green-500 text-white' :
                  step.active ? 'bg-primary text-primary-foreground' :
                  'bg-muted text-muted-foreground'
                }`}>
                  {step.completed ? (
                    <CheckCircle className="h-6 w-6" />
                  ) : (
                    <Icon className="h-6 w-6" />
                  )}
                </div>
                <div className="text-center">
                  <p className="font-medium text-sm">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
              </div>
              {index < steps.length - 1 && (
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          );
        })}
      </div>

      {/* Current Step Content */}
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Target className="h-5 w-5" />
            <span>Set Your SEO Goals</span>
          </CardTitle>
          <CardDescription>
            Help us understand what you want to achieve with SEO
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h4 className="font-medium mb-3">Primary Goals (Select all that apply):</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                'Increase organic traffic',
                'Improve search rankings',
                'Generate more leads',
                'Boost online sales',
                'Enhance brand visibility',
                'Local search optimization'
              ].map((goal, index) => (
                <label key={index} className="flex items-center space-x-2 p-3 border border-border rounded cursor-pointer hover:bg-muted">
                  <input type="checkbox" className="rounded" />
                  <span className="text-sm">{goal}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium mb-3">Target Metrics:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Monthly Traffic Goal</label>
                <select className="w-full p-2 border border-border rounded">
                  <option>1,000 - 5,000 visits</option>
                  <option>5,000 - 10,000 visits</option>
                  <option>10,000 - 25,000 visits</option>
                  <option>25,000+ visits</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Timeline</label>
                <select className="w-full p-2 border border-border rounded">
                  <option>3 months</option>
                  <option>6 months</option>
                  <option>12 months</option>
                  <option>Ongoing</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Additional Information</label>
            <textarea 
              className="w-full p-3 border border-border rounded"
              rows={4}
              placeholder="Tell us about any specific challenges, competitors, or additional context that might help us better serve you..."
            ></textarea>
          </div>

          <div className="flex space-x-3">
            <Button variant="outline" className="flex-1">Back</Button>
            <Button className="flex-1">Complete Setup</Button>
          </div>
        </CardContent>
      </Card>

      {/* Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Personalized Strategy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Get a custom SEO strategy based on your specific goals and industry.
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Expert Guidance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Work with SEO professionals who understand your business needs.
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Measurable Results</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Track your progress with detailed analytics and regular reports.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}