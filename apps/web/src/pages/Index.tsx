import { useState } from "react";
import { CreateRoom } from "@/components/CreateRoom";
import { JoinRoom } from "@/components/JoinRoom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gamepad2, Users, Zap } from "lucide-react";

const Index = () => {
  const [activeTab, setActiveTab] = useState<"create" | "join">("create");

  return (
    <div className="min-h-screen gradient-bg">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-6xl font-bold text-foreground mb-4 tracking-tight">
            Puzzz
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            The ultimate party game platform. Create rooms, join friends, and enjoy endless entertainment together.
          </p>
        </div>

        {/* Main Action Area */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-card rounded-lg p-1 shadow-sm border">
              <Button
                variant={activeTab === "create" ? "default" : "ghost"}
                onClick={() => setActiveTab("create")}
                className="px-8 py-3 text-lg"
              >
                Create Room
              </Button>
              <Button
                variant={activeTab === "join" ? "default" : "ghost"}
                onClick={() => setActiveTab("join")}
                className="px-8 py-3 text-lg"
              >
                Join Room
              </Button>
            </div>
          </div>

          <div className="flex justify-center">
            {activeTab === "create" ? <CreateRoom /> : <JoinRoom />}
          </div>
        </div>

        {/* Features Section */}
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-foreground">
            Why Choose Puzzz?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="text-center card-interactive">
              <CardHeader>
                <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
                  <Gamepad2 className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">Instant Fun</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  No accounts, no downloads. Just share a room code and start playing immediately.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center card-interactive">
              <CardHeader>
                <div className="mx-auto mb-4 p-3 bg-accent/10 rounded-full w-fit">
                  <Users className="h-8 w-8 text-accent" />
                </div>
                <CardTitle className="text-xl">Real-time Multiplayer</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Connect with friends in real-time. See votes and reactions as they happen.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center card-interactive">
              <CardHeader>
                <div className="mx-auto mb-4 p-3 bg-success/10 rounded-full w-fit">
                  <Zap className="h-8 w-8 text-success" />
                </div>
                <CardTitle className="text-xl">Endless Entertainment</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Hundreds of engaging questions and more games coming soon.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Games Preview */}
        <div className="max-w-4xl mx-auto mt-16">
          <h2 className="text-3xl font-bold text-center mb-8 text-foreground">
            Available Games
          </h2>
          
          <Card className="card-interactive">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl">Would You Rather</CardTitle>
                <span className="bg-success text-success-foreground px-3 py-1 rounded-full text-sm font-medium">
                  Available Now
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-lg mb-4">
                Choose between two interesting scenarios and see how your friends vote. 
                With 200+ carefully crafted questions across multiple categories.
              </CardDescription>
              <div className="flex gap-4">
                <Button 
                  className="bg-game-option-a hover:bg-game-option-a/90 text-white"
                  size="lg"
                >
                  Option A
                </Button>
                <Button 
                  className="bg-game-option-b hover:bg-game-option-b/90 text-white"
                  size="lg"
                >
                  Option B
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;
