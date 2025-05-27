import { Button } from "@/components/ui/button";

export default function FeaturedSection() {
  return (
    <div className="p-8 bg-white rounded-xl shadow-sm overflow-hidden">
      <div className="flex flex-col items-start gap-8 md:flex-row">
        <div className="flex-1">
          <h2 className="text-2xl font-semibold tracking-tight mb-4">
            Rylie AI Platform
          </h2>
          <p className="text-neutral-600 leading-relaxed mb-6">
            The next-generation conversational AI for automotive dealerships.
            Elevate your customer interactions with smart, context-aware
            responses.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-6 mb-6">
            <div className="flex items-center">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                <span className="material-icons text-primary text-xs">
                  check
                </span>
              </span>
              <span className="text-sm text-neutral-700">
                Seamless API integration
              </span>
            </div>
            <div className="flex items-center">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                <span className="material-icons text-primary text-xs">
                  check
                </span>
              </span>
              <span className="text-sm text-neutral-700">
                Customizable personas
              </span>
            </div>
            <div className="flex items-center">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                <span className="material-icons text-primary text-xs">
                  check
                </span>
              </span>
              <span className="text-sm text-neutral-700">
                Real-time inventory awareness
              </span>
            </div>
            <div className="flex items-center">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                <span className="material-icons text-primary text-xs">
                  check
                </span>
              </span>
              <span className="text-sm text-neutral-700">
                Intelligent escalation
              </span>
            </div>
          </div>

          <Button className="inline-flex items-center px-5 py-2">
            Learn More
            <span className="material-icons ml-2 text-xs">arrow_forward</span>
          </Button>
        </div>

        <div className="w-full md:w-2/5 lg:w-1/3">
          <div
            className="w-full h-60 rounded-lg bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1600880292203-757bb62b4baf?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=400')",
            }}
          ></div>
        </div>
      </div>
    </div>
  );
}
