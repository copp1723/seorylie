import React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

const SecurityCompliancePage: React.FC = () => {
  return (
    <div className="container mx-auto py-10">
      <div className="mb-10">
        <h1 className="text-4xl font-bold mb-4">Security & Compliance</h1>
        <p className="text-xl text-muted-foreground">
          Enterprise-grade security and compliance information for Rylie AI
          platform
        </p>
      </div>

      <Tabs defaultValue="overview" className="mb-10">
        <TabsList className="mb-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="data-security">Data Security</TabsTrigger>
          <TabsTrigger value="auditing">Auditing</TabsTrigger>
          <TabsTrigger value="access-control">Access Control</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Security Overview</CardTitle>
              <CardDescription>
                Rylie AI platform's security architecture and principles
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Security Design Principles
                </h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Defense in depth: Multiple security controls implemented at
                    different layers
                  </li>
                  <li>
                    Least privilege: Access limited to only what is necessary
                    for functionality
                  </li>
                  <li>
                    Secure by design: Security built into the architecture from
                    the start
                  </li>
                  <li>
                    Data protection: Comprehensive controls for data-at-rest and
                    data-in-transit
                  </li>
                  <li>
                    Ongoing verification: Continuous security monitoring and
                    assessment
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Security Architecture
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Infrastructure Security
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        <li>
                          Cloud-based infrastructure with built-in redundancy
                        </li>
                        <li>Network isolation and segmentation</li>
                        <li>DDoS protection and Web Application Firewall</li>
                        <li>Regular security patching and updates</li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Application Security
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="list-disc pl-5 space-y-1 text-sm">
                        <li>
                          Secure SDLC with code reviews and security testing
                        </li>
                        <li>Input validation and output encoding</li>
                        <li>Protection against OWASP Top 10 vulnerabilities</li>
                        <li>Dependency vulnerability scanning</li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <p className="text-sm text-muted-foreground">
                For more detailed security information, please contact your
                account representative.
              </p>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Security Certifications</CardTitle>
              <CardDescription>
                Compliance certifications and attestations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground mb-2">
                  Our security roadmap includes pursuing the following
                  certifications:
                </p>
                <div className="flex flex-wrap gap-3">
                  <Badge
                    variant="outline"
                    className="text-sm py-2 px-3 bg-muted/30"
                  >
                    SOC 2 Type II (Planned)
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-sm py-2 px-3 bg-muted/30"
                  >
                    GDPR Readiness
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-sm py-2 px-3 bg-muted/30"
                  >
                    HIPAA Capability
                  </Badge>
                  <Badge
                    variant="outline"
                    className="text-sm py-2 px-3 bg-muted/30"
                  >
                    ISO 27001 (Future)
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  While we follow industry best practices for security, we are
                  currently building our compliance program. Contact us for the
                  latest status and documentation on our security measures.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Programs</CardTitle>
              <CardDescription>
                Details about our compliance programs and certifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="soc2">
                  <AccordionTrigger>
                    <div className="flex items-center">
                      <span>SOC 2 Type II</span>
                      <Badge className="ml-2">Preparation Phase</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="mb-2">
                      Our SOC 2 Type II preparation includes:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>
                        Security - Building controls for protection against
                        unauthorized access
                      </li>
                      <li>
                        Availability - Implementing system monitoring and
                        availability safeguards
                      </li>
                      <li>
                        Processing Integrity - Developing controls for complete,
                        accurate processing
                      </li>
                      <li>
                        Confidentiality - Designing systems to protect
                        confidential information
                      </li>
                      <li>
                        Privacy - Establishing appropriate data handling
                        procedures
                      </li>
                    </ul>
                    <p className="mt-2 text-sm text-muted-foreground">
                      We are actively working toward formal SOC 2 certification.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="gdpr">
                  <AccordionTrigger>
                    <div className="flex items-center">
                      <span>GDPR Readiness</span>
                      <Badge className="ml-2">In Progress</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="mb-2">
                      Our GDPR readiness program is developing:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Data Processing Agreement (DPA) templates</li>
                      <li>Data protection processes and documentation</li>
                      <li>Breach notification procedures</li>
                      <li>Data subject rights request handling</li>
                      <li>Data mapping and inventory</li>
                    </ul>
                    <p className="mt-2 text-sm text-muted-foreground">
                      We are implementing GDPR-aligned practices, though formal
                      verification is pending.
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="hipaa">
                  <AccordionTrigger>
                    <div className="flex items-center">
                      <span>HIPAA Capabilities</span>
                      <Badge className="ml-2">Under Development</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="mb-2">
                      Our HIPAA capability development focuses on:
                    </p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Business Associate Agreement templates</li>
                      <li>
                        Administrative, physical, and technical safeguard
                        planning
                      </li>
                      <li>Encryption of data at rest and in transit</li>
                      <li>Security incident procedures</li>
                      <li>Risk assessment methodologies</li>
                    </ul>
                    <p className="mt-2 text-sm text-muted-foreground">
                      While we are designing for HIPAA capability, we are not
                      yet formally HIPAA compliant.
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data-security" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Data Protection</CardTitle>
              <CardDescription>
                How we protect customer data throughout its lifecycle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Data Encryption
                  </h3>
                  <Table>
                    <TableCaption>
                      Encryption standards used across the platform
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data Type</TableHead>
                        <TableHead>At Rest</TableHead>
                        <TableHead>In Transit</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>Customer Data</TableCell>
                        <TableCell>AES-256</TableCell>
                        <TableCell>TLS 1.2+</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Authentication</TableCell>
                        <TableCell>Bcrypt Hashing</TableCell>
                        <TableCell>TLS 1.2+</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>API Keys</TableCell>
                        <TableCell>AES-256</TableCell>
                        <TableCell>TLS 1.2+</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Conversation Data</TableCell>
                        <TableCell>AES-256</TableCell>
                        <TableCell>TLS 1.2+</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">
                    Data Retention & Disposal
                  </h3>
                  <p className="mb-4">
                    Our data handling approach focuses on responsible management
                    practices:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>
                      Customer data is retained according to contractual
                      agreements
                    </li>
                    <li>Regular backups with configurable retention periods</li>
                    <li>Industry standard secure data deletion practices</li>
                    <li>
                      Data export functionality for customer data portability
                    </li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">Data Isolation</h3>
                  <p>
                    Customer data is logically isolated through robust
                    multi-tenancy controls:
                  </p>
                  <ul className="list-disc pl-5 space-y-1">
                    <li>
                      Each customer's data is logically segregated in the
                      database
                    </li>
                    <li>Access controls enforce strict tenant boundaries</li>
                    <li>
                      Database queries are filtered by tenant ID at the
                      application layer
                    </li>
                    <li>
                      Continuous monitoring for potential isolation breaches
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auditing" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Comprehensive Audit Logging</CardTitle>
              <CardDescription>
                How we track and monitor system activity for security and
                compliance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Audit Log Contents
                </h3>
                <p className="mb-2">
                  Our audit logs capture detailed information about:
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Authentication events (login attempts, password changes)
                  </li>
                  <li>Authorization decisions (access granted/denied)</li>
                  <li>Data access (viewing, modifying, deleting)</li>
                  <li>System configuration changes</li>
                  <li>API key usage and management</li>
                  <li>Admin actions and privilege usage</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Log Retention & Protection
                </h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Logs are stored for a minimum of 12 months</li>
                  <li>Logs are digitally signed to prevent tampering</li>
                  <li>Access to logs is restricted and itself logged</li>
                  <li>Logs are backed up on a separate system</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Audit Reports</h3>
                <p className="mb-2">
                  Enterprise customers can access security audit reports
                  through:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">
                        Admin Dashboard
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <p>
                        Interactive reports available for authorized
                        administrators with filtering options.
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">API Access</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <p>
                        Programmatic access to audit logs via secure API
                        endpoints for integration with SIEM systems.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="outline">Download Sample Audit Report</Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="access-control" className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Access Control System</CardTitle>
              <CardDescription>
                How we manage and restrict access to sensitive resources
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Identity & Authentication
                </h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Multi-factor authentication support</li>
                  <li>SSO integration via SAML 2.0 and OpenID Connect</li>
                  <li>Password policies enforcing complexity and expiration</li>
                  <li>Account lockout after multiple failed attempts</li>
                  <li>Session timeout and automatic logout</li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  Authorization Model
                </h3>
                <p className="mb-2">
                  Role-based access control (RBAC) with granular permissions:
                </p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      <TableHead>Access Level</TableHead>
                      <TableHead>Description</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Administrator</TableCell>
                      <TableCell>Full access</TableCell>
                      <TableCell>
                        Complete system control including user management
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Manager</TableCell>
                      <TableCell>Limited admin</TableCell>
                      <TableCell>
                        Can configure dealership settings and view all
                        conversations
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Agent</TableCell>
                      <TableCell>Operational</TableCell>
                      <TableCell>
                        Can handle customer conversations and view assigned
                        vehicles
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Viewer</TableCell>
                      <TableCell>Read-only</TableCell>
                      <TableCell>
                        Can only view data without making changes
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>API</TableCell>
                      <TableCell>Programmatic</TableCell>
                      <TableCell>
                        Limited to specific API endpoints based on scopes
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">
                  API Authentication
                </h3>
                <ul className="list-disc pl-5 space-y-1">
                  <li>API key authentication with key rotation capability</li>
                  <li>OAuth 2.0 for delegated authorization</li>
                  <li>JWT tokens with short expiration times</li>
                  <li>Rate limiting to prevent abuse</li>
                  <li>IP restrictions for API access</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-8 p-6 border rounded-lg bg-muted/50">
        <h2 className="text-xl font-semibold mb-4">Need More Information?</h2>
        <p className="mb-4">
          For detailed security documentation or to request a compliance
          attestation, please contact your account representative or our
          security team.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button>Contact Security Team</Button>
          <Button variant="outline">Request Documentation</Button>
          <Button variant="outline">Schedule Security Review</Button>
        </div>
      </div>
    </div>
  );
};

export default SecurityCompliancePage;
