# Specialized Automotive Agents Documentation

## Overview

The Agent Squad system includes 8 specialized automotive agents, each with domain-specific knowledge, training data, and capabilities tailored to different aspects of the automotive customer journey.

## Agent Architecture

### Core Components

- **Agent Configurations**: Comprehensive capability definitions with training data
- **Prompt Templates**: Domain-specific instructions and conversation guidelines
- **Function Calling**: Real-time database integration for inventory and operations
- **Advanced Routing**: Sentiment analysis and context-aware agent selection
- **Analytics Tracking**: Performance monitoring and continuous improvement

---

## 1. General Assistant Agent (`general-agent`)

### Primary Purpose

Friendly first point of contact for customer interactions, greetings, and general inquiries.

### Capabilities

- Customer greeting and rapport building
- General automotive knowledge sharing
- Needs assessment and discovery
- Dealership information provision
- Basic inventory overview
- Customer routing to specialists
- Building excitement and engagement

### Domain Knowledge

- Vehicle categories (Sedan, SUV, Truck, etc.)
- Fuel types (Gasoline, Hybrid, Electric, etc.)
- Drive types (FWD, RWD, AWD, 4WD)
- Safety features and automotive basics
- Dealership services overview

### Function Capabilities

- `getInventorySummary()` - Provides general inventory overview

### Routing Keywords

`hello`, `hi`, `greeting`, `browsing`, `looking`, `general`, `help`, `information`, `dealership`, `overview`

### Example Interactions

- "Hello! I'm new to car buying"
- "Tell me about your dealership"
- "I'm just browsing today"
- "What kind of cars do you have?"

---

## 2. Inventory Specialist Agent (`inventory-agent`)

### Primary Purpose

Expert in vehicle search, specifications, features, and real-time inventory availability.

### Capabilities

- Real-time inventory search with multiple filters
- Vehicle specification expertise and comparisons
- Feature explanation and benefits analysis
- Pricing and value proposition analysis
- Alternative vehicle suggestions
- Availability status and timing updates
- Market knowledge and competitive positioning

### Domain Knowledge

- Complete vehicle specifications (engines, performance, features)
- Market trends and brand reliability
- Seasonal demand patterns
- Competitive analysis and positioning
- Industry incentives and manufacturer programs

### Function Capabilities

- `searchInventory()` - Dynamic vehicle search with filtering
- `getVehicleDetails()` - Detailed vehicle information by VIN/ID
- `getInventorySummary()` - Dealership inventory statistics

### Routing Keywords

`looking for`, `need`, `want`, `car`, `vehicle`, `truck`, `suv`, `inventory`, `available`, `price`, `features`, `specs`, `mileage`

### Example Interactions

- "I'm looking for a fuel-efficient car under $25,000"
- "Do you have any red Honda Civics?"
- "What's the difference between the Camry and Accord?"
- "I need a truck for work with good towing capacity"

---

## 3. Finance Specialist Agent (`finance-agent`)

### Primary Purpose

Expert in automotive financing, loans, leases, and credit solutions.

### Capabilities

- Auto loan vs leasing education and comparison
- Payment calculation and budgeting assistance
- Credit score counseling and improvement strategies
- Down payment strategy optimization
- Interest rate explanation and factors
- Trade-in financing integration
- Protection product education
- Pre-approval process guidance

### Domain Knowledge

- Loan structures (36-84 month terms, interest types)
- Lease fundamentals (24-39 months, residual values)
- Credit score ranges and impact (300-850 scale)
- Down payment benefits and requirements
- Manufacturer incentive programs

### Routing Keywords

`financing`, `loan`, `lease`, `payment`, `monthly`, `credit`, `score`, `down payment`, `interest`, `rate`, `apr`, `budget`, `afford`

### Example Interactions

- "Should I lease or buy?"
- "What will my monthly payment be on a $30,000 car?"
- "My credit score is 640, what are my options?"
- "How does a larger down payment help?"

---

## 4. Service Specialist Agent (`service-agent`)

### Primary Purpose

Automotive service and maintenance specialist for repairs, scheduling, and vehicle care.

### Capabilities

- Maintenance scheduling and planning
- Repair diagnosis and explanation
- Service cost estimation and budgeting
- Warranty guidance and coverage explanation
- Safety issue identification and prioritization
- Seasonal maintenance planning
- Service history tracking and recommendations

### Domain Knowledge

- Preventive maintenance schedules by mileage/time
- Common automotive problems and solutions
- Warranty coverage and protection plans
- Service interval timing and optimization
- Emergency repair prioritization

### Routing Keywords

`service`, `maintenance`, `repair`, `oil change`, `appointment`, `schedule`, `noise`, `problem`, `warranty`, `brake`, `tire`, `inspection`

### Example Interactions

- "My car is making a grinding noise when I brake"
- "When should I get my oil changed?"
- "I need to schedule a service appointment"
- "Is this repair covered under warranty?"

---

## 5. Trade-in Specialist Agent (`trade-agent`)

### Primary Purpose

Vehicle trade-in valuation specialist with market analysis expertise.

### Capabilities

- Vehicle valuation and market analysis
- Trade-in process guidance and education
- Condition assessment education
- Market timing advice and optimization
- Documentation requirements guidance
- Value maximization strategies
- Financing integration with trade equity

### Domain Knowledge

- Market value analysis and depreciation trends
- Condition assessment factors and impact
- Regional market variations and timing
- Brand reliability and resale patterns
- Mileage impact calculations

### Routing Keywords

`trade`, `trade-in`, `value`, `worth`, `appraisal`, `estimate`, `owe`, `payoff`, `negative equity`, `current car`, `sell`

### Example Interactions

- "What's my 2020 Toyota Camry worth?"
- "I owe more than my car is worth"
- "When is the best time to trade in?"
- "Why is my trade value lower than KBB?"

---

## 6. Sales Specialist Agent (`sales-agent`)

### Primary Purpose

Sales specialist for test drives, purchase process, and customer conversion.

### Capabilities

- Test drive scheduling and coordination
- Vehicle demonstration and feature education
- Purchase process guidance and facilitation
- Objection handling and concern resolution
- Incentive communication and promotion awareness
- Delivery coordination and timeline management
- Customer relationship building and follow-up

### Domain Knowledge

- Test drive best practices and safety protocols
- Purchase process steps and documentation
- Incentive programs and promotional timing
- Objection handling techniques
- Customer experience optimization

### Routing Keywords

`test drive`, `schedule`, `buy`, `purchase`, `ready`, `decision`, `paperwork`, `delivery`, `incentive`, `promotion`, `deal`

### Example Interactions

- "I'd like to schedule a test drive"
- "I'm ready to buy, what's next?"
- "I'm not sure if this is the right car"
- "Are there any current promotions?"

---

## 7. Credit Specialist Agent (`credit-agent`)

### Primary Purpose

Specialized expert for customers with challenging credit situations and complex financing needs.

### Capabilities

- Credit assessment and counseling
- Subprime financing expertise
- Credit rebuilding guidance and strategies
- Down payment strategizing for approval
- Co-signer education and requirements
- Alternative financing solutions
- Second chance financing programs

### Domain Knowledge

- Bad credit and no credit financing options
- Credit rebuilding strategies and timelines
- Subprime lending programs and requirements
- Co-signer guidance and responsibilities
- Life event credit impact assessment

### Routing Keywords

`bad credit`, `no credit`, `bankruptcy`, `first time buyer`, `co-signer`, `credit problems`, `rebuilding credit`, `second chance`

### Example Interactions

- "I have bad credit, can you help me?"
- "I've never had credit before"
- "I filed bankruptcy last year"
- "Do I need a co-signer?"

---

## 8. Lease Specialist Agent (`lease-agent`)

### Primary Purpose

Expert in leasing programs, lease returns, and lease-specific customer lifecycle management.

### Capabilities

- Lease program education and comparison
- Lease-end guidance and option explanation
- Mileage and wear planning
- Lease vs buy analysis for specific situations
- Early termination counseling
- Business lease expertise and programs

### Domain Knowledge

- Lease terms and structure explanation
- Mileage allowances and overage management
- Wear and tear guidelines and standards
- Lease-end options and processes
- Lease transfer and assumption programs

### Routing Keywords

`lease`, `leasing`, `lease end`, `return`, `mileage`, `wear and tear`, `lease payment`, `residual`, `buyout`

### Example Interactions

- "My lease is ending soon, what are my options?"
- "I'm over my mileage allowance"
- "Can I buy my leased vehicle?"
- "What are lease wear and tear charges?"

---

## Advanced Features

### Intelligent Routing

- **Sentiment Analysis**: Detects emotional state and urgency
- **Context Awareness**: Considers conversation history and customer profile
- **Multi-factor Decision Making**: Combines content, sentiment, and customer context
- **Escalation Logic**: Automatically routes to human agents when appropriate

### Function Calling Integration

- **Real-time Data Access**: Live inventory, pricing, and availability
- **Database Integration**: Customer history, preferences, and analytics
- **Service Coordination**: Appointment scheduling and service history

### Analytics and Learning

- **Performance Tracking**: Response times, confidence scores, success rates
- **Continuous Improvement**: Learning from interactions and outcomes
- **A/B Testing**: Testing different approaches and configurations

### Escalation Triggers

- Safety concerns or urgent repairs
- Negative sentiment or customer frustration
- Complex situations requiring human expertise
- Pricing negotiations beyond standard parameters
- Legal or compliance-related questions

---

## Configuration Management

### Per-Dealership Customization

- Agent personality and tone adjustments
- Brand-specific knowledge and positioning
- Local market expertise and inventory focus
- Custom incentive and promotion integration

### Performance Optimization

- Confidence threshold adjustments
- Routing logic refinement
- Response time optimization
- Success rate monitoring and improvement

---

## Testing and Validation

### Automated Testing Suite

- Domain-specific scenario testing
- Cross-agent routing validation
- Function calling verification
- Escalation scenario testing

### Performance Metrics

- Routing accuracy rates
- Customer satisfaction scores
- Response time optimization
- Escalation rate monitoring

---

## Implementation Notes

### Technical Requirements

- OpenAI GPT-4 integration for advanced language understanding
- Real-time database connectivity for function calling
- Analytics tracking for performance monitoring
- Scalable architecture for multiple dealerships

### Best Practices

- Regular training data updates
- Continuous performance monitoring
- Customer feedback integration
- Industry knowledge updates

---

_This documentation covers the comprehensive automotive agent system designed to provide specialized, expert-level assistance across all aspects of the automotive customer journey._
