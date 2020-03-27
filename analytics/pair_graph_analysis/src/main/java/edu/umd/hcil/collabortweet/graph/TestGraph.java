package edu.umd.hcil.collabortweet.graph;

import org.graphstream.graph.Edge;
import org.graphstream.graph.Graph;
import org.graphstream.graph.Node;
import org.graphstream.graph.implementations.SingleGraph;

import java.util.Collection;

/**
 * Created by cbuntain on 5/4/17.
 */
public class TestGraph {

    public static void main(String[] args) {
        Graph graph = new SingleGraph("Tutorial 1");

        graph.addNode("A" );
        graph.addNode("B" );
        graph.addNode("C" );
        graph.addEdge("AB", "A", "B", true);
        graph.addEdge("BC", "B", "C", true);
        graph.addEdge("CA", "C", "A", true);

//        graph.display();

        Collection<Node> nodeList = graph.getNodeSet();
        Node aNode = graph.getNode("A");
        System.out.println("Edges to A:");
        for ( Edge e : aNode.getLeavingEdgeSet() ) {
            System.out.println("\t" + e);
        }

        graph.removeEdge("A", "B");

        System.out.println("Edges to A:");
        for ( Edge e : aNode.getLeavingEdgeSet() ) {
            System.out.println("\t" + e);
        }
    }

}
